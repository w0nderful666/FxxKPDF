/* global window, document, WebAssembly */
/*
 * Browser QPDF adapter.
 * Uses qpdf-wasm-esm-embedded vendored at ./libs/qpdf/qpdf.mjs. The module is
 * a single ESM file with embedded WASM, so GitHub Pages does not need a custom
 * .wasm MIME setup.
 */
window.PdfQpdf = (() => {
  const MODULE_URL = new URL("./libs/qpdf/qpdf.mjs", document.baseURI).href;
  const INPUT = "/work/input.pdf";
  const OUTPUT = "/work/output.pdf";
  let modulePromise = null;
  let qpdfModule = null;
  let lastRunLog = [];

  function normalizeBytes(bytes) {
    if (bytes instanceof Uint8Array) return bytes;
    if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
    throw new Error("QPDF 输入必须是 Uint8Array 或 ArrayBuffer。");
  }

  function classifyError(error) {
    const message = error?.message || String(error);
    if (window.location.protocol === "file:") {
      return new Error("QPDF 模块需要通过本地静态服务器或 GitHub Pages 访问，请使用 python -m http.server 8080。基础 PDF 功能仍可继续使用。");
    }
    if (!("WebAssembly" in window)) return new Error("当前浏览器不支持 WebAssembly，无法启用 QPDF 模块。");
    if (/Failed to resolve module specifier|about:blank|base URL|CORS-cross-origin/i.test(message)) {
      return new Error(`QPDF 模块路径解析失败：请通过页面地址加载 ${MODULE_URL}，不要从跨源脚本或 about:blank 上下文调用。`);
    }
    if (/Failed to fetch|404|not found|ERR_FILE_NOT_FOUND|Cannot find module|Importing a module script failed/i.test(message)) {
      return new Error(`QPDF 模块文件不存在：请确认 ${MODULE_URL} 已部署。`);
    }
    if (/MIME|module script|text\/html|disallowed MIME/i.test(message)) {
      return new Error("QPDF 模块 MIME 类型错误：请确认静态服务器按 JavaScript 模块提供 qpdf.mjs。");
    }
    if (/instantiate|compile|wasm|WebAssembly/i.test(message)) {
      return new Error(`QPDF WebAssembly 初始化失败：${message}`);
    }
    return new Error(message);
  }

  async function loadQpdfModule() {
    if (qpdfModule) return qpdfModule;
    if (modulePromise) return modulePromise;
    if (!("WebAssembly" in window)) throw classifyError(new Error("WebAssembly unavailable"));

    modulePromise = import(MODULE_URL)
      .then(async (mod) => {
        const factory = mod.default || mod.createModule;
        if (typeof factory !== "function") throw new Error("qpdf API 不匹配：模块没有默认初始化函数。");
        const instance = await factory({
          print: (text) => lastRunLog.push(String(text)),
          printErr: (text) => lastRunLog.push(String(text))
        });
        if (!instance?.FS || typeof instance.callMain !== "function") {
          throw new Error("qpdf API 不匹配：缺少 FS 或 callMain。");
        }
        qpdfModule = instance;
        ensureWorkDir();
        return qpdfModule;
      })
      .catch((error) => {
        modulePromise = null;
        throw classifyError(error);
      });

    return modulePromise;
  }

  function ensureWorkDir() {
    if (!qpdfModule?.FS) return;
    try {
      qpdfModule.FS.mkdir("/work");
    } catch (_error) {
      // Directory already exists.
    }
  }

  function unlinkQuiet(path) {
    try {
      qpdfModule.FS.unlink(path);
    } catch (_error) {
      // Missing temp files are harmless.
    }
  }

  function mapQpdfError(args, code, logs) {
    const text = logs.join("\n");
    if (code === 0) return null;
    if (/invalid password|incorrect password|password.*incorrect/i.test(text)) return new Error("打开密码不正确，请检查后重试。");
    if (/password.*required|requires a password|invalid password/i.test(text)) return new Error("此 PDF 需要正确打开密码。请输入你已知的打开密码后重试。");
    if (/RMS|rights management|DRM|unsupported encryption|unsupported security/i.test(text)) {
      return new Error("此文件可能使用 DRM、企业权限、在线授权或指定阅读器限制，本工具不会处理这类文件。");
    }
    if (/damaged|repair|xref|object stream|unable to find|not a pdf|invalid pdf/i.test(text)) {
      return new Error("QPDF 无法重写该文件，可尝试图片化重建副本。");
    }
    return new Error(`QPDF 处理失败（退出码 ${code}）：${text || args.join(" ")}`);
  }

  async function runQpdf(args, inputBytes, outputPath = OUTPUT) {
    const mod = await loadQpdfModule();
    ensureWorkDir();
    lastRunLog = [];
    unlinkQuiet(INPUT);
    unlinkQuiet(OUTPUT);
    mod.FS.writeFile(INPUT, normalizeBytes(inputBytes));
    try {
      const code = mod.callMain(args);
      const mapped = mapQpdfError(args, code, lastRunLog);
      if (mapped) throw mapped;
      if (!outputPath) return { logs: [...lastRunLog] };
      return new Uint8Array(mod.FS.readFile(outputPath));
    } finally {
      unlinkQuiet(INPUT);
      unlinkQuiet(OUTPUT);
    }
  }

  function passwordArg(password) {
    return `--password=${password || ""}`;
  }

  async function makeNormalCopy(bytes, options = {}) {
    const args = [];
    args.push(passwordArg(options.password || ""));
    if (options.removeRestrictions !== false) args.push("--decrypt");
    if (options.linearize) args.push("--linearize");
    args.push(INPUT, OUTPUT);
    return runQpdf(args, bytes, OUTPUT);
  }

  function permissionArgs(permissions = {}) {
    const allowPrint = permissions.print !== false;
    const allowCopy = permissions.copy !== false;
    const allowModify = permissions.modify === true;
    const allowAnnotate = permissions.annotate === true;
    const allowForms = permissions.forms === true;
    const allowExtract = permissions.extract !== false;
    return [
      `--print=${allowPrint ? "full" : "none"}`,
      `--modify=${allowModify ? "all" : allowAnnotate ? "annotate" : allowForms ? "form" : "none"}`,
      `--extract=${allowCopy || allowExtract ? "y" : "n"}`,
      `--annotate=${allowAnnotate ? "y" : "n"}`,
      `--form=${allowForms ? "y" : "n"}`,
      `--assemble=${allowExtract ? "y" : "n"}`
    ];
  }

  async function encryptPdf(bytes, options = {}) {
    const userPassword = options.userPassword || "";
    if (!userPassword) throw new Error("请设置打开密码。");
    const ownerPassword = options.ownerPassword || userPassword;
    const args = [
      "--encrypt",
      userPassword,
      ownerPassword,
      "256",
      ...permissionArgs(options.permissions),
      "--",
      INPUT,
      OUTPUT
    ];
    return runQpdf(args, bytes, OUTPUT);
  }

  function parseEncryptionReport(logs) {
    const text = logs.join("\n");
    const notEncrypted = /File is not encrypted/i.test(text);
    const encrypted = !notEncrypted && (/R =|P =|Encryption/i.test(text));
    const needsPassword = /invalid password|password.*required|requires a password/i.test(text);
    const ownerRestricted = encrypted && !/modify all|extract for any purpose: allowed|print high resolution: allowed/i.test(text);
    return {
      available: true,
      encrypted,
      needsPassword,
      ownerRestricted,
      canMakeNormalCopy: !needsPassword,
      raw: text
    };
  }

  async function inspect(bytes, options = {}) {
    try {
      await loadQpdfModule();
      const args = [passwordArg(options.password || ""), "--show-encryption", INPUT];
      const result = await runQpdf(args, bytes, null);
      return parseEncryptionReport(result.logs);
    } catch (error) {
      const message = classifyError(error).message;
      if (qpdfModule) {
        return {
          available: true,
          encrypted: /密码|password|required|incorrect/i.test(message) ? true : null,
          needsPassword: /需要正确打开密码|required/i.test(message),
          ownerRestricted: null,
          canMakeNormalCopy: false,
          error: message
        };
      }
      return {
        available: false,
        encrypted: null,
        needsPassword: null,
        ownerRestricted: null,
        canMakeNormalCopy: false,
        error: message
      };
    }
  }

  return {
    isAvailable: () => Boolean(qpdfModule),
    loadQpdfModule,
    makeNormalCopy,
    encryptPdf,
    inspect
  };
})();
