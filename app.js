/* global PDFLib, pdfjsLib, Sortable, JSZip */

// ==================== i18n System (v0.3.1: delegated to window.i18n) ====================
/* v0.3.1: I18N object moved to js/i18n.js → window.i18n */
const t = window.i18n.t;
let currentLang = window.i18n.getLang();

function applyI18N() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (text) el.textContent = text;
  });
  // Re-render tool cards with current language
  $$(".tool-card").forEach((card) => {
    const nameKey = card.dataset.nameKey;
    const descKey = card.dataset.descKey;
    if (nameKey) card.querySelector("strong").textContent = t(nameKey);
    if (descKey) card.querySelector("span").textContent = t(descKey);
  });
  // Update active tool title/desc
  const meta = tools.find((tool) => tool[0] === state.active);
  if (meta) {
    $("#activeToolTitle").textContent = t(meta[1]);
    $("#activeToolDesc").textContent = t(meta[2]);
  }
  // Update langBtn text
  const langBtn = document.getElementById("langBtn");
  if (langBtn) langBtn.textContent = currentLang === "zh" ? "中文" : "EN";
  // Update html lang
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
}

function toggleLang() {
  currentLang = currentLang === "zh" ? "en" : "zh";
  window.i18n.setLang(currentLang);
  applyI18N();
  saveSettingsState();
}

// ==================== Settings Persistence (v0.3.1: delegated to window.storage) ====================
/* v0.3.1: localStorage operations moved to js/storage.js → window.storage */
const SETTINGS_KEY = window.siteMeta.storageKeys.settings;

function getSettings() { return window.storage.getSettings(); }
function saveSettings(patch) { window.storage.saveSettings(patch); }

function saveSettingsState() {
  saveSettings({
    theme: document.documentElement.dataset.theme || "light",
    lang: currentLang,
    lastTool: state?.active || "merge"
  });
}

function loadSettingsFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("theme")) {
    const theme = params.get("theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
      window.storage.safeSet(window.siteMeta.storageKeys.theme, theme);
    }
  }
  if (params.has("lang")) {
    const lang = params.get("lang");
    if (lang === "zh" || lang === "en") {
      currentLang = lang;
      window.i18n.setLang(lang);
    }
  }
}

function addRecentOperation(tool, filename, outputSize, extra = {}) {
  window.storage.addRecentOperation(tool, filename, outputSize, extra);
}

const exportSettings = window.storage.exportSettings;
const importSettings = window.storage.importSettings;

// ==================== Original Code ====================
const { PDFDocument, degrees, rgb } = PDFLib;

pdfjsLib.GlobalWorkerOptions.workerSrc = "./libs/pdfjs/pdf.worker.min.js";

// v0.3.1: Tool list from toolRegistry
const tools = window.toolRegistry.getLegacyArray();

const state = {
  active: "merge",
  merge: { files: [] },
  split: { file: null, pageCount: 0 },
  manage: { file: null, pages: [], selected: new Set(), pageCount: 0 },
  number: { file: null },
  textwatermark: { file: null },
  imagewatermark: { pdf: null, image: null, previewUrl: null, imageSize: null },
  signature: { pdf: null, image: null, drawing: false, hasDrawing: false, pageCount: 0 },
  annotate: { pdf: null, image: null, pageCount: 0 },
  permissions: { file: null, info: null },
  normalcopy: { file: null, pageCount: 0 },
  protect: { file: null },
  metadata: { file: null, info: null, pageCount: 0 },
  imagepdf: { files: [], dimensions: new Map() }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const largePreviews = new Map();

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeFileName(name) {
  return String(name || "document")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 80) || "document";
}

function buildOutputName(fileOrName, suffix) {
  const raw = typeof fileOrName === "string" ? fileOrName : fileOrName?.name || "document.pdf";
  const clean = sanitizeFileName(raw.replace(/\.pdf$/i, ""));
  return `${clean}-${suffix}.pdf`;
}

function showAlert(message, type = "success") {
  const el = document.createElement("div");
  el.className = `alert ${type}`;
  el.textContent = message;
  $("#alerts").appendChild(el);
  window.setTimeout(() => el.remove(), 6200);
}

function friendlyError(error) {
  const message = error?.message || String(error);
  if (/qpdf|wasm|WebAssembly|模块加载|暂不支持|module|未启用|打开密码不正确|需要正确打开密码|DRM|企业权限|在线授权|指定阅读器|图片化重建/i.test(message)) {
    return message;
  }
  if (/encrypted|password|权限|加密|protect|security/i.test(message)) {
    return "此 PDF 可以预览，但无法被当前编辑引擎修改。它可能设置了权限保护、编辑限制、数字签名、表单保护或特殊 PDF 结构。当前工具不会破解或绕过文件保护。如果这是你有权处理的文件，可以尝试从原软件另存为普通 PDF 后再处理。能打开查看不代表一定能编辑。";
  }
  return message;
}

function setBusy(button, busy, text) {
  if (!button) return;
  if (busy) {
    button.dataset.oldText = button.textContent;
    button.textContent = text || "处理中...";
    button.disabled = true;
  } else {
    button.textContent = button.dataset.oldText || button.textContent;
    button.disabled = false;
  }
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function warnLargeFiles(files) {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (files.some((file) => file.size > 100 * 1024 * 1024)) {
    showAlert("单个文件超过 100MB，处理速度会取决于你的设备性能。", "warn");
  }
  if (total > 200 * 1024 * 1024) showAlert("当前文件总大小超过 200MB，浏览器可能需要更久处理。", "warn");
}

async function bytesFromFile(file) {
  return new Uint8Array(await file.arrayBuffer());
}

async function loadPdfLib(file) {
  try {
    return await PDFDocument.load(await bytesFromFile(file));
  } catch (error) {
    throw new Error("此 PDF 可以预览，但无法被当前编辑引擎修改。它可能设置了权限保护、编辑限制、数字签名、表单保护或特殊 PDF 结构。当前工具不会破解或绕过文件保护。如果这是你有权处理的文件，可以尝试从原软件另存为普通 PDF 后再处理。如果这是扫描件或图片内容，可以使用“JPG / PNG 转 PDF”重新生成。能打开查看不代表一定能编辑。");
  }
}

function makeDownload(anchor, bytes, filename) {
  const safeFilename = filename.toLowerCase().endsWith(".pdf")
    ? `${sanitizeFileName(filename.replace(/\.pdf$/i, ""))}.pdf`
    : buildOutputName(filename, "output");
  if (anchor.dataset.url) URL.revokeObjectURL(anchor.dataset.url);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  anchor.href = url;
  anchor.dataset.url = url;
  anchor.download = safeFilename;
  anchor.classList.remove("hidden");
  return { url, size: bytes.length, filename: safeFilename };
}

function clearResult(toolId) {
  const resultId = {
    imagewatermark: "imageWatermark",
    textwatermark: "textWatermark",
    imagepdf: "imagePdf"
  }[toolId] || toolId;
  const result = $(`#${resultId}Result`);
  if (result) {
    result.classList.add("hidden");
    result.innerHTML = "";
  }
  const panel = $(`#panel-${toolId}`);
  panel?.querySelectorAll(".download-btn").forEach((a) => a.classList.add("hidden"));
}

function showResult(toolId, anchor, bytes, filename, detail = "") {
  const info = makeDownload(anchor, bytes, filename);
  const resultId = {
    imagewatermark: "imageWatermark",
    textwatermark: "textWatermark",
    imagepdf: "imagePdf"
  }[toolId] || toolId;
  const result = $(`#${resultId}Result`);
  if (result) {
    result.innerHTML = `
      <strong>处理完成</strong>
      <p>${escapeHTML(info.filename)} · ${formatSize(info.size)}${detail ? ` · ${escapeHTML(detail)}` : ""}</p>
      <div class="button-row">
        <a class="download-btn" href="${info.url}" download="${escapeHTML(info.filename)}">下载文件</a>
        <button class="ghost-btn" type="button" data-result-clear="${toolId}">再处理一个文件 / 清空</button>
      </div>
    `;
    result.classList.remove("hidden");
    result.querySelector("[data-result-clear]").addEventListener("click", () => clearTool(toolId));
    result.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    anchor.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  anchor.classList.add("pulse");
  window.setTimeout(() => anchor.classList.remove("pulse"), 2000);
  addRecentOperation(toolId, info.filename, info.size);
  return info;
}

function showConfirm(message, onConfirm) {
  const config = typeof message === "object" ? message : { message };
  const backdrop = document.createElement("div");
  backdrop.className = "confirm-backdrop";
  const box = document.createElement("div");
  box.className = "confirm-box";
  box.innerHTML = `
    <h3>${escapeHTML(config.title || "确认操作")}</h3>
    <p>${escapeHTML(config.message || "")}</p>
    <div class="button-row">
      <button class="primary-btn" type="button">${escapeHTML(config.confirmText || "继续")}</button>
      <button class="ghost-btn" type="button">${escapeHTML(config.cancelText || "取消")}</button>
    </div>
  `;
  const close = () => { backdrop.remove(); box.remove(); };
  box.querySelector(".primary-btn").addEventListener("click", () => { close(); onConfirm(); });
  box.querySelector(".ghost-btn").addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.body.append(backdrop, box);
}

async function getPdfPageCount(file) {
  const pdf = await getPdfJsDocument(file);
  return pdf.numPages;
}

function renderFileMeta(target, file, extra = "") {
  const el = typeof target === "string" ? $(target) : target;
  if (!el || !file) return;
  el.textContent = `${file.name} · ${formatSize(file.size)}${extra ? ` · ${extra}` : ""}`;
}

function colorToRgb(hex) {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// v0.3.1: Page range parsing delegated to window.rangeParser
function parsePageRange(input, total) { return window.rangeParser.parsePageRange(input, total); }
function parsePageRangeDetailed(input, total) { return window.rangeParser.parsePageRangeDetailed(input, total); }
function summarizePages(numbers) { return window.rangeParser.summarizePages(numbers); }

// ==================== v0.3.0: Enhanced Page Range Parser ====================
// v0.3.1: Delegated to window.rangeParser
function parsePageRanges(input, totalPages) { return window.rangeParser.parsePageRanges(input, totalPages); }

// ==================== v0.3.0: ZIP Download Utilities ====================
// v0.3.1: Delegated to window.zipUtils
function getZipFileName() { return window.zipUtils.getZipFileName(); }
async function downloadAsZip(files, baseName) { return window.zipUtils.downloadAsZip(files, baseName); }
function showZipResult(toolId, files, zipFileName) { return window.zipUtils.showZipResult(toolId, files, zipFileName); }

async function getPdfJsDocument(file) {
  const data = await bytesFromFile(file);
  const loadingTask = pdfjsLib.getDocument({ data });
  loadingTask.onPassword = (updatePassword, reason) => {
    updatePassword("");
  };
  return loadingTask.promise;
}

async function getPdfJsDocumentWithPassword(file, password = "") {
  const data = await bytesFromFile(file);
  const loadingTask = pdfjsLib.getDocument({ data, password });
  return loadingTask.promise;
}

function permissionValue(permissions, flag) {
  if (!permissions) return "允许";
  if (!flag) return "未知";
  return permissions.includes(flag) ? "允许" : "受限";
}

function statusClass(value) {
  if (value === "允许" || value === "可用" || value === "未发现") return "status-ok";
  if (value === "未知" || value === "可能存在" || value === "可能残留") return "status-warn";
  return "status-bad";
}

function renderStatusRows(rows) {
  return `<div class="status-list">${rows.map(([labelText, value]) => `
    <div class="status-row"><span>${escapeHTML(labelText)}</span><b class="${statusClass(value)}">${escapeHTML(value)}</b></div>
  `).join("")}</div>`;
}

async function detectPdfPermissions(file, password = "") {
  const bytes = await bytesFromFile(file);
  const textProbe = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.length, 2_000_000)));
  const mayHaveSignature = /\/ByteRange|\/Sig\b|\/DocMDP|\/FieldMDP/.test(textProbe);
  let pdf = null;
  let needsPassword = false;
  let canPreview = false;
  let pageCount = 0;
  let permissions = null;
  let previewError = "";

  try {
    pdf = await getPdfJsDocumentWithPassword(file, password);
    canPreview = true;
    pageCount = pdf.numPages;
    permissions = await pdf.getPermissions();
  } catch (error) {
    needsPassword = /Password|password|NeedPassword|IncorrectPassword/i.test(error?.name || error?.message || "");
    previewError = needsPassword ? "需要正确打开密码" : friendlyError(error);
  }

  let editableByPdfLib = false;
  try {
    await PDFDocument.load(bytes);
    editableByPdfLib = true;
  } catch (_error) {
    editableByPdfLib = false;
  }

  const flag = pdfjsLib.PermissionFlag || {};
  let qpdf = {
    available: false,
    encrypted: null,
    needsPassword: null,
    ownerRestricted: null,
    canMakeNormalCopy: false,
    error: "QPDF 模块未启用"
  };
  if (window.PdfQpdf?.inspect) {
    qpdf = await window.PdfQpdf.inspect(bytes, { password });
  }

  return {
    pageCount,
    canPreview,
    needsPassword,
    previewError,
    mayHaveSignature,
    editableByPdfLib,
    qpdf,
    rows: [
      ["是否需要打开密码", needsPassword ? "受限" : "允许"],
      ["是否允许打印", permissionValue(permissions, flag.PRINT || flag.PRINT_HIGH_QUALITY)],
      ["是否允许复制", permissionValue(permissions, flag.COPY)],
      ["是否允许修改", permissionValue(permissions, flag.MODIFY_CONTENTS)],
      ["是否允许注释", permissionValue(permissions, flag.MODIFY_ANNOTATIONS)],
      ["是否允许填写表单", permissionValue(permissions, flag.FILL_INTERACTIVE_FORMS)],
      ["是否允许签名", "未知"],
      ["是否允许提取页面", permissionValue(permissions, flag.ASSEMBLE)]
    ]
  };
}

async function renderPreview(file, target, options = {}) {
  const container = typeof target === "string" ? $(target) : target;
  container.innerHTML = '<div class="empty-preview">正在渲染缩略图...</div>';
  try {
    const pdf = await getPdfJsDocument(file);
    const limit = Math.min(pdf.numPages, options.limit || 100);
    container.innerHTML = "";
    if (pdf.numPages > limit) showAlert(`为了避免浏览器卡顿，当前仅预览前 ${limit} 页，但导出仍以实际选择为准。当前 PDF 共 ${pdf.numPages} 页。`, "warn");
    for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.18 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.dataset.pdfWidth = String(viewport.width / 0.18);
      canvas.dataset.pdfHeight = String(viewport.height / 0.18);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const card = document.createElement("div");
      card.className = "thumb";
      card.dataset.page = String(pageNumber - 1);
      card.append(canvas, label(`第 ${pageNumber} 页`));
      container.appendChild(card);
    }
    return pdf.numPages;
  } catch (error) {
    container.innerHTML = '<div class="empty-preview">预览失败</div>';
    showAlert("PDF 预览失败。文件可能需要密码打开，或浏览器无法读取该 PDF。当前版本不新增密码输入功能。", "error");
    return 0;
  }
}

function createLargePreview(containerId, options = {}) {
  const container = $(containerId);
  if (!container) return null;
  container.innerHTML = `
    <div class="large-preview-toolbar">
      <button class="ghost-btn" type="button" data-prev>上一页</button>
      <button class="ghost-btn" type="button" data-next>下一页</button>
      <span>第 <input type="number" min="1" value="1" data-page-input> / <b data-total>0</b> 页</span>
      <select data-zoom>
        <option value="fit">适应宽度</option>
        <option value="0.75">75%</option>
        <option value="1">100%</option>
        <option value="1.25">125%</option>
        <option value="1.5">150%</option>
      </select>
    </div>
    <div class="large-preview-stage" data-stage>
      <div class="large-loading">上传 PDF 后显示单页大预览。为了避免浏览器卡顿，大预览每次只渲染当前页。</div>
    </div>
  `;
  const preview = {
    container,
    file: null,
    pageNumber: 1,
    totalPages: 0,
    zoom: "fit",
    renderToken: 0,
    pdfWidth: 0,
    pdfHeight: 0,
    options
  };
  largePreviews.set(containerId, preview);
  container.querySelector("[data-prev]").addEventListener("click", () => setLargePreviewPage(containerId, preview.pageNumber - 1));
  container.querySelector("[data-next]").addEventListener("click", () => setLargePreviewPage(containerId, preview.pageNumber + 1));
  container.querySelector("[data-page-input]").addEventListener("change", (event) => setLargePreviewPage(containerId, Number(event.target.value)));
  container.querySelector("[data-zoom]").addEventListener("change", (event) => {
    preview.zoom = event.target.value;
    renderLargePreviewPage(containerId);
  });
  return preview;
}

function clearLargePreview(containerId) {
  const preview = largePreviews.get(containerId);
  if (!preview) return;
  preview.file = null;
  preview.pageNumber = 1;
  preview.totalPages = 0;
  preview.container.querySelector("[data-total]").textContent = "0";
  preview.container.querySelector("[data-page-input]").value = "1";
  preview.container.querySelector("[data-stage]").innerHTML = '<div class="large-loading">上传 PDF 后显示单页大预览。为了避免浏览器卡顿，大预览每次只渲染当前页。</div>';
}

async function loadLargePreview(containerId, file, totalPages = 0) {
  const preview = largePreviews.get(containerId) || createLargePreview(containerId);
  if (!preview) return;
  preview.file = file;
  preview.pageNumber = 1;
  preview.totalPages = totalPages || await getPdfPageCount(file);
  preview.container.querySelector("[data-total]").textContent = String(preview.totalPages);
  preview.container.querySelector("[data-page-input]").value = "1";
  if (preview.totalPages > 100) showAlert("为了避免浏览器卡顿，大预览每次只渲染当前页。", "warn");
  await renderLargePreviewPage(containerId);
}

async function setLargePreviewPage(containerId, pageNumber) {
  const preview = largePreviews.get(containerId);
  if (!preview || !preview.file) return;
  preview.pageNumber = Math.max(1, Math.min(preview.totalPages, pageNumber || 1));
  preview.container.querySelector("[data-page-input]").value = String(preview.pageNumber);
  if (preview.options.onPageChange) preview.options.onPageChange(preview.pageNumber);
  await renderLargePreviewPage(containerId);
}

async function renderLargePreviewPage(containerId) {
  const preview = largePreviews.get(containerId);
  if (!preview || !preview.file) return;
  const token = ++preview.renderToken;
  const stage = preview.container.querySelector("[data-stage]");
  stage.innerHTML = '<div class="large-loading">正在渲染当前页...</div>';
  try {
    const pdf = await getPdfJsDocument(preview.file);
    const page = await pdf.getPage(preview.pageNumber);
    const base = page.getViewport({ scale: 1 });
    const fitScale = Math.max(0.35, Math.min(2.2, (stage.clientWidth - 32) / base.width));
    const scale = preview.zoom === "fit" ? fitScale : Number(preview.zoom);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.dataset.pdfWidth = String(base.width);
    canvas.dataset.pdfHeight = String(base.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    if (token !== preview.renderToken) return;
    preview.pdfWidth = base.width;
    preview.pdfHeight = base.height;
    const pageBox = document.createElement("div");
    pageBox.className = "large-preview-page";
    pageBox.style.width = `${viewport.width}px`;
    pageBox.appendChild(canvas);
    const overlay = document.createElement("div");
    overlay.className = "large-preview-overlay";
    pageBox.appendChild(overlay);
    stage.innerHTML = "";
    stage.appendChild(pageBox);
    pageBox.addEventListener("click", (event) => {
      if (event.target.classList.contains("placement-box")) return;
      if (preview.options.onClick) preview.options.onClick(event, preview);
    });
    updateLargePreviewOverlay(containerId);
  } catch (error) {
    stage.innerHTML = '<div class="large-error">大预览渲染失败。文件可能需要密码打开，或浏览器无法读取该页。</div>';
  }
}

function getLargePreviewPoint(event, preview, boxWidth = 0, boxHeight = 0) {
  const canvas = preview.container.querySelector("canvas");
  const rect = canvas.getBoundingClientRect();
  const xRatio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const yRatio = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  return {
    x: Math.round(xRatio * preview.pdfWidth - boxWidth / 2),
    y: Math.round((1 - yRatio) * preview.pdfHeight - boxHeight / 2)
  };
}

function placeOverlayBox(containerId, x, y, w, h, className = "", onMove) {
  const preview = largePreviews.get(containerId);
  if (!preview) return;
  const overlay = preview.container.querySelector(".large-preview-overlay");
  if (!overlay) return;
  overlay.innerHTML = "";
  const box = document.createElement("div");
  box.className = `placement-box ${className}`.trim();
  box.style.left = `${(x / preview.pdfWidth) * 100}%`;
  box.style.top = `${((preview.pdfHeight - y - h) / preview.pdfHeight) * 100}%`;
  box.style.width = `${(w / preview.pdfWidth) * 100}%`;
  box.style.height = `${(h / preview.pdfHeight) * 100}%`;
  overlay.appendChild(box);
  let dragging = false;
  const move = (event) => {
    if (!dragging) return;
    event.preventDefault();
    const point = event.touches ? event.touches[0] : event;
    const fake = { clientX: point.clientX, clientY: point.clientY };
    const next = getLargePreviewPoint(fake, preview, w, h);
    box.style.left = `${(next.x / preview.pdfWidth) * 100}%`;
    box.style.top = `${((preview.pdfHeight - next.y - h) / preview.pdfHeight) * 100}%`;
    onMove(next);
  };
  box.addEventListener("pointerdown", (event) => {
    dragging = true;
    box.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  box.addEventListener("pointermove", move);
  box.addEventListener("pointerup", () => { dragging = false; });
  box.addEventListener("pointercancel", () => { dragging = false; });
}

function updateLargePreviewOverlay(containerId) {
  if (containerId === "#signatureLargePreview") updateSignaturePlacement();
  if (containerId === "#annotateLargePreview") updateAnnotatePlacement();
  if (containerId === "#textWatermarkLargePreview") updateTextWatermarkOverlay();
  if (containerId === "#imageWatermarkLargePreview") updateImageWatermarkOverlay();
  if (containerId === "#numberLargePreview") updateNumberOverlay();
}

function initLargePreviews() {
  createLargePreview("#numberLargePreview");
  createLargePreview("#textWatermarkLargePreview");
  createLargePreview("#imageWatermarkLargePreview");
  createLargePreview("#signatureLargePreview", {
    onPageChange: (pageNo) => {
      $("#signaturePage").value = pageNo;
      updateSignaturePlacement();
    },
    onClick: (event, preview) => {
      const w = Number($("#signatureWidth").value || 160);
      const h = Math.max(28, w * 0.35);
      const point = getLargePreviewPoint(event, preview, w, h);
      $("#signaturePage").value = preview.pageNumber;
      $("#signatureX").value = Math.max(0, point.x);
      $("#signatureY").value = Math.max(0, point.y);
      updateSignaturePlacement();
    }
  });
  createLargePreview("#annotateLargePreview", {
    onPageChange: (pageNo) => {
      $("#annotatePage").value = pageNo;
      updateAnnotatePlacement();
    },
    onClick: (event, preview) => {
      const w = Number($("#annotateW").value || 120);
      const h = Number($("#annotateH").value || 60);
      const point = getLargePreviewPoint(event, preview, w, h);
      $("#annotatePage").value = preview.pageNumber;
      $("#annotateX").value = Math.max(0, point.x);
      $("#annotateY").value = Math.max(0, point.y);
      updateAnnotatePlacement();
    }
  });
}

function label(text) {
  const span = document.createElement("span");
  span.className = "page-label";
  span.textContent = text;
  return span;
}

function renderFileList(container, files) {
  container.innerHTML = "";
  files.forEach((file, index) => {
    const li = document.createElement("li");
    li.dataset.index = String(index);
    const name = document.createElement("span");
    name.textContent = `${index + 1}. ${file.name}`;
    const meta = document.createElement("small");
    meta.textContent = `${formatSize(file.size)}${file._pageCount ? ` · ${file._pageCount} 页` : ""}`;
    li.append(name, meta);
    container.appendChild(li);
  });
}

async function attachPdfPageCounts(files) {
  await Promise.all(files.map(async (file) => {
    try {
      file._pageCount = await getPdfPageCount(file);
    } catch (error) {
      file._pageCount = 0;
    }
  }));
}

function syncSortableFiles(container, getFiles, afterSort) {
  return new Sortable(container, {
    animation: 150,
    onEnd: () => {
      const files = getFiles();
      const reordered = Array.from(container.children).map((item) => files[Number(item.dataset.index)]);
      files.splice(0, files.length, ...reordered);
      renderFileList(container, files);
      if (afterSort) afterSort();
    }
  });
}

function createTextPng(text, options = {}) {
  const size = Number(options.size || 36);
  const color = options.color || "#111827";
  const opacity = Number(options.opacity ?? 1);
  const pad = size;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `700 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  const metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width + pad * 2);
  canvas.height = Math.ceil(size * 1.8 + pad);
  ctx.font = `700 ${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.textBaseline = "middle";
  ctx.fillText(text, pad, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

async function embedImage(pdfDoc, fileOrDataUrl) {
  const bytes = typeof fileOrDataUrl === "string"
    ? Uint8Array.from(atob(fileOrDataUrl.split(",")[1]), (c) => c.charCodeAt(0))
    : await bytesFromFile(fileOrDataUrl);
  const type = typeof fileOrDataUrl === "string" ? (fileOrDataUrl.match(/^data:([^;]+)/)?.[1] || "image/png") : fileOrDataUrl.type;
  return type.includes("png") ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
}

function placeInPage(page, boxW, boxH, position, margin = 36) {
  const { width, height } = page.getSize();
  const map = {
    center: [(width - boxW) / 2, (height - boxH) / 2],
    "top-left": [margin, height - boxH - margin],
    "bottom-right": [width - boxW - margin, margin],
    "bottom-center": [(width - boxW) / 2, margin],
    "bottom-left": [margin, margin],
    "top-center": [(width - boxW) / 2, height - boxH - margin],
    "top-right": [width - boxW - margin, height - boxH - margin]
  };
  return map[position] || map.center;
}

function computeImageWatermarkLayout({ pageWidth, pageHeight, imageWidth, imageHeight, scaleRatio, position, margin = 40, rotate = 0 }) {
  const ratio = imageWidth && imageHeight ? imageHeight / imageWidth : 0.45;
  let width = pageWidth * Number(scaleRatio || 0.35);
  let height = width * ratio;
  if (height > pageHeight * 0.9) {
    height = pageHeight * 0.9;
    width = height / ratio;
  }
  const [x, y] = placeInPage(
    { getSize: () => ({ width: pageWidth, height: pageHeight }) },
    width,
    height,
    position,
    margin
  );
  return { x, y, width, height, rotate: Number(rotate || 0) };
}

async function copySelectedPages(sourceFile, pageIndexes, rotations = []) {
  const src = await loadPdfLib(sourceFile);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, pageIndexes);
  pages.forEach((page, i) => {
    const existing = page.getRotation().angle || 0;
    page.setRotation(degrees((existing + (rotations[i] || 0) + 360) % 360));
    out.addPage(page);
  });
  return out.save();
}

function setupTools() {
  const grid = $("#toolGrid");
  tools.forEach(([id, nameKey, descKey]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tool-card ${id === state.active ? "active" : ""}`;
    button.dataset.tool = id;
    button.dataset.nameKey = nameKey;
    button.dataset.descKey = descKey;
    button.innerHTML = `<strong>${t(nameKey)}</strong><span>${t(descKey)}</span>`;
    button.addEventListener("click", () => activateTool(id));
    grid.appendChild(button);
  });
}

function activateTool(id) {
  state.active = id;
  const meta = tools.find((tool) => tool[0] === id);
  $("#activeToolTitle").textContent = t(meta[1]);
  $("#activeToolDesc").textContent = t(meta[2]);
  $$(".tool-card").forEach((card) => card.classList.toggle("active", card.dataset.tool === id));
  $$(".tool-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.tool === id));
  $("#workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  saveSettingsState();
}

function clearTool(id) {
  const panel = $(`#panel-${id}`);
  panel.querySelectorAll("input").forEach((input) => {
    if (input.type === "checkbox") {
      input.checked = false;
      return;
    }
    if (input.type === "color") return;
    input.value = "";
  });
  panel.querySelectorAll(".image-preview-grid img").forEach((img) => {
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
  });
  panel.querySelectorAll(".thumb-grid,.image-preview-grid,.file-list").forEach((el) => { el.innerHTML = ""; });
  panel.querySelectorAll(".download-btn").forEach((a) => a.classList.add("hidden"));
  panel.querySelectorAll(".result-card").forEach((el) => { el.classList.add("hidden"); el.innerHTML = ""; });
  panel.querySelectorAll(".file-meta").forEach((el) => { el.textContent = ""; });
  const largeMap = {
    number: "#numberLargePreview",
    textwatermark: "#textWatermarkLargePreview",
    imagewatermark: "#imageWatermarkLargePreview",
    signature: "#signatureLargePreview",
    annotate: "#annotateLargePreview"
  };
  if (largeMap[id]) clearLargePreview(largeMap[id]);
  if (id === "merge") state.merge.files = [];
  if (id === "imagepdf") state.imagepdf.files = [];
  if (id === "manage") state.manage = { file: null, pages: [], selected: new Set(), pageCount: 0 };
  if (id === "permissions") state.permissions = { file: null, info: null };
  if (id === "normalcopy") state.normalcopy = { file: null, pageCount: 0 };
  if (id === "protect") state.protect = { file: null };
  if (id === "metadata") state.metadata = { file: null, info: null, pageCount: 0 };
  if (id === "signature") {
    const canvas = $("#signaturePad");
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }
  if (id === "imagewatermark" && state.imagewatermark.previewUrl) {
    URL.revokeObjectURL(state.imagewatermark.previewUrl);
    state.imagewatermark.previewUrl = null;
    state.imagewatermark.imageSize = null;
  }
  if (state[id]) Object.keys(state[id]).forEach((key) => {
    if (Array.isArray(state[id][key])) state[id][key] = [];
    else if (state[id][key] instanceof Set) state[id][key] = new Set();
    else if (state[id][key] instanceof Map) state[id][key] = new Map();
    else if (typeof state[id][key] === "boolean") state[id][key] = false;
    else state[id][key] = null;
  });
  showAlert(t("alert_cleared"));
}

function handleNewInput(toolId) {
  clearResult(toolId);
}

async function initMerge() {
  const input = $("#mergeFiles");
  const list = $("#mergeList");
  syncSortableFiles(list, () => state.merge.files);
  input.addEventListener("change", async () => {
    handleNewInput("merge");
    state.merge.files = Array.from(input.files);
    warnLargeFiles(state.merge.files);
    await attachPdfPageCounts(state.merge.files);
    renderFileList(list, state.merge.files);
  });
  $("#mergeBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (state.merge.files.length < 2) throw new Error("请至少上传两个 PDF。");
      setBusy(btn, true, "正在合并...");
      const out = await PDFDocument.create();
      for (const file of state.merge.files) {
        const src = await loadPdfLib(file);
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((page) => out.addPage(page));
      }
      const bytes = await out.save();
      showResult("merge", $("#mergeDownload"), bytes, buildOutputName(state.merge.files[0], "merged"), `${out.getPageCount()} 页`);
      showAlert("合并完成，可以下载了。");
      addRecentOperation("merge", buildOutputName(state.merge.files[0], "merged"), bytes.length, { inputCount: state.merge.files.length, outputCount: 1 });
    } catch (error) {
      showAlert(friendlyError(error), "error");
    } finally {
      setBusy(btn, false);
    }
  });
}

async function initSplit() {
  const validate = () => {
    const help = $("#splitRangeHelp");
    const summary = $("#splitSummary");
    const mode = $("#splitMode").value;
    help.className = "field-help";
    if (!state.split.file || !state.split.pageCount) {
      summary.textContent = currentLang === "zh" ? "上传 PDF 后可预览和选择页码。" : "Upload a PDF to preview and select pages.";
      help.textContent = "";
      return null;
    }
    if (mode === "perpage") {
      summary.textContent = currentLang === "zh"
        ? `预计输出 ${state.split.pageCount} 个文件，每页一个 PDF。`
        : `Estimated output: ${state.split.pageCount} files, one PDF per page.`;
      help.textContent = "";
      return { indexes: Array.from({ length: state.split.pageCount }, (_, i) => i), numbers: Array.from({ length: state.split.pageCount }, (_, i) => i + 1), mode: "perpage" };
    }
    try {
      const parsed = parsePageRanges($("#splitRange").value, state.split.pageCount);
      help.textContent = "";
      if (mode === "ranges") {
        summary.textContent = currentLang === "zh"
          ? `预计输出 ${parsed.numbers.length} 个文件，每页一个 PDF。`
          : `Estimated output: ${parsed.numbers.length} files, one PDF per page.`;
      } else {
        summary.textContent = summarizePages(parsed.numbers);
      }
      return { ...parsed, mode };
    } catch (error) {
      help.textContent = error.message;
      help.classList.add("error");
      summary.textContent = currentLang === "zh"
        ? `当前 PDF 共 ${state.split.pageCount || 0} 页。`
        : `This PDF has ${state.split.pageCount || 0} pages.`;
      return null;
    }
  };
  // Mode change
  $("#splitMode").addEventListener("change", () => {
    const mode = $("#splitMode").value;
    $("#splitRangeField").classList.toggle("hidden", mode === "perpage");
    $("#splitPresets").classList.toggle("hidden", mode === "perpage");
    validate();
  });
  $("#splitFile").addEventListener("change", async (event) => {
    handleNewInput("split");
    const file = event.target.files[0];
    state.split.file = file;
    if (file) warnLargeFiles([file]);
    state.split.pageCount = file ? await renderPreview(file, "#splitPreview") : 0;
    if (file) {
      renderFileMeta("#splitMeta", file, state.split.pageCount ? `${state.split.pageCount} 页` : "页数读取失败");
      $("#splitRange").value = state.split.pageCount ? `1-${state.split.pageCount}` : "";
    }
    validate();
  });
  $("#splitRange").addEventListener("input", validate);
  $$("[data-split-preset]").forEach((button) => button.addEventListener("click", () => {
    if (!state.split.pageCount) {
      showAlert(currentLang === "zh" ? "请先上传一个 PDF。" : "Please upload a PDF first.", "warn");
      return;
    }
    const total = state.split.pageCount;
    const preset = button.dataset.splitPreset;
    const values = {
      all: "all",
      odd: "odd",
      even: "even",
      first5: `1-${Math.min(5, total)}`,
      last5: `${Math.max(1, total - 4)}-${total}`
    };
    $("#splitRange").value = values[preset];
    validate();
  }));
  $("#splitBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (!state.split.file) throw new Error(currentLang === "zh" ? "请先上传一个 PDF。" : "Please upload a PDF first.");
      const parsed = validate();
      if (!parsed) throw new Error(currentLang === "zh" ? "请先修正页面范围。" : "Please fix the page range first.");
      setBusy(btn, true, currentLang === "zh" ? "正在生成..." : "Generating...");
      const mode = parsed.mode;
      if (mode === "perpage" || mode === "ranges") {
        // Multiple output files → ZIP
        const files = [];
        for (let i = 0; i < parsed.indexes.length; i += 1) {
          const pageIdx = parsed.indexes[i];
          const pageName = `split-page-${parsed.numbers[i]}.pdf`;
          const bytes = await copySelectedPages(state.split.file, [pageIdx]);
          files.push({ name: pageName, data: bytes });
        }
        showZipResult("split", files);
        showAlert(currentLang === "zh" ? `拆分完成，共 ${files.length} 个文件。` : `Split complete, ${files.length} files.`);
      } else {
        // Single output file
        const bytes = await copySelectedPages(state.split.file, parsed.indexes);
        showResult("split", $("#splitDownload"), bytes, buildOutputName(state.split.file, "extracted"), `${parsed.indexes.length} 页`);
        showAlert(t("success_split"));
        addRecentOperation("split", buildOutputName(state.split.file, "extracted"), bytes.length, { inputCount: 1, outputCount: 1, pageRange: $("#splitRange").value });
      }
    } catch (error) {
      showAlert(friendlyError(error), "error");
    } finally {
      setBusy(btn, false);
    }
  });
}

async function initManage() {
  new Sortable($("#managePreview"), {
    animation: 150,
    onEnd: () => {
      const visibleIds = Array.from($("#managePreview").children).map((item) => item.dataset.id);
      const visiblePages = visibleIds.map((id) => state.manage.pages.find((p) => p.id === id)).filter(Boolean);
      const hiddenPages = state.manage.pages.filter((p) => !visibleIds.includes(p.id));
      state.manage.pages = [...visiblePages, ...hiddenPages];
      renderManagePages();
    }
  });
  $("#manageFile").addEventListener("change", async (event) => {
    handleNewInput("manage");
    const file = event.target.files[0];
    if (!file) return;
    warnLargeFiles([file]);
    state.manage.file = file;
    state.manage.selected = new Set();
    const count = await renderPreview(file, "#managePreview");
    state.manage.pageCount = count;
    state.manage.pages = Array.from({ length: count }, (_, i) => ({ id: crypto.randomUUID(), index: i, rotation: 0 }));
    renderFileMeta("#manageMeta", file, count ? `${count} 页` : "页数读取失败");
    renderManagePages();
  });
  $("#manageSelectAllBtn").addEventListener("click", () => selectManagePages("all"));
  $("#manageClearSelectBtn").addEventListener("click", () => selectManagePages("none"));
  $("#manageInvertBtn").addEventListener("click", () => selectManagePages("invert"));
  $("#manageOddBtn").addEventListener("click", () => selectManagePages("odd"));
  $("#manageEvenBtn").addEventListener("click", () => selectManagePages("even"));
  $("#manageDeleteBtn").addEventListener("click", () => {
    const count = state.manage.selected.size;
    if (!count) {
      showAlert("请先选择要删除的页面。", "warn");
      return;
    }
    const run = () => {
      state.manage.pages = state.manage.pages.filter((p) => !state.manage.selected.has(p.id));
      state.manage.selected.clear();
      renderManagePages();
    };
    if (count >= 5) showConfirm(`你将删除 ${count} 页。此操作只影响当前工作区，导出前不会修改原文件。`, run);
    else run();
  });
  // v0.3.0: Range-based delete
  $("#manageDeleteRangeBtn").addEventListener("click", () => {
    if (!state.manage.file || !state.manage.pageCount) {
      showAlert(currentLang === "zh" ? "请先上传一个 PDF。" : "Please upload a PDF first.", "warn");
      return;
    }
    try {
      const parsed = parsePageRanges($("#manageRange").value, state.manage.pageCount);
      const count = parsed.numbers.length;
      const run = () => {
        const deleteSet = new Set(parsed.indexes);
        state.manage.pages = state.manage.pages.filter((p) => !deleteSet.has(p.index));
        state.manage.selected.clear();
        renderManagePages();
        showAlert(currentLang === "zh"
          ? `${t("manage_range_deleted")}：${parsed.numbers.join(", ")}`
          : `${t("manage_range_deleted")}: ${parsed.numbers.join(", ")}`);
      };
      if (count >= 5) showConfirm(currentLang === "zh"
        ? `你将删除 ${count} 页（${parsed.numbers.slice(0, 8).join(", ")}${count > 8 ? "..." : ""}）。此操作只影响当前工作区。`
        : `You will delete ${count} pages (${parsed.numbers.slice(0, 8).join(", ")}${count > 8 ? "..." : ""}). This only affects the workspace.`, run);
      else run();
    } catch (error) {
      showAlert(error.message, "error");
    }
  });
  // v0.3.0: Range-based keep (keep only specified pages)
  $("#manageKeepRangeBtn").addEventListener("click", () => {
    if (!state.manage.file || !state.manage.pageCount) {
      showAlert(currentLang === "zh" ? "请先上传一个 PDF。" : "Please upload a PDF first.", "warn");
      return;
    }
    try {
      const parsed = parsePageRanges($("#manageRange").value, state.manage.pageCount);
      const keepSet = new Set(parsed.indexes);
      state.manage.pages = state.manage.pages.filter((p) => keepSet.has(p.index));
      state.manage.selected.clear();
      renderManagePages();
      showAlert(currentLang === "zh"
        ? `${t("manage_range_kept")}：${parsed.numbers.join(", ")}`
        : `${t("manage_range_kept")}: ${parsed.numbers.join(", ")}`);
    } catch (error) {
      showAlert(error.message, "error");
    }
  });
  $("#manageLeftBtn").addEventListener("click", () => rotateSelected(-90));
  $("#manageRightBtn").addEventListener("click", () => rotateSelected(90));
  $("#manageExtractBtn").addEventListener("click", async (event) => exportManage(event.currentTarget, true));
  $("#manageExportBtn").addEventListener("click", async (event) => exportManage(event.currentTarget, false));
}

function selectManagePages(mode) {
  if (!state.manage.pages.length) {
    showAlert("请先上传一个 PDF。", "warn");
    return;
  }
  const selected = state.manage.selected;
  if (mode === "none") selected.clear();
  else if (mode === "all") state.manage.pages.forEach((p) => selected.add(p.id));
  else if (mode === "invert") state.manage.pages.forEach((p) => selected.has(p.id) ? selected.delete(p.id) : selected.add(p.id));
  else if (mode === "odd" || mode === "even") {
    selected.clear();
    state.manage.pages.forEach((p) => {
      const pageNo = p.index + 1;
      if (mode === "odd" ? pageNo % 2 === 1 : pageNo % 2 === 0) selected.add(p.id);
    });
  }
  renderManagePages();
}

function updateSelectionSummary() {
  const el = $("#manageSummary");
  if (!el) return;
  el.textContent = `总页数 ${state.manage.pageCount || 0} · 已选择 ${state.manage.selected.size} 页 · 当前导出 ${state.manage.pages.length} 页`;
}

function renderManagePages() {
  const preview = $("#managePreview");
  const existing = Array.from(preview.children);
  state.manage.pages.forEach((page, order) => {
    const card = existing.find((el) => Number(el.dataset.page) === page.index);
    if (!card) return;
    card.dataset.id = page.id;
    card.dataset.page = String(page.index);
    let wrap = card.querySelector(".thumb-canvas-wrap");
    const canvas = card.querySelector("canvas");
    if (canvas && !wrap) {
      wrap = document.createElement("div");
      wrap.className = "thumb-canvas-wrap";
      canvas.before(wrap);
      wrap.appendChild(canvas);
      canvas.classList.add("rotated-preview");
    }
    if (canvas) canvas.style.transform = `rotate(${page.rotation}deg) scale(${page.rotation % 180 ? 0.72 : 1})`;
    card.classList.toggle("selected", state.manage.selected.has(page.id));
    const labelEl = card.querySelector(".page-label");
    if (labelEl) labelEl.textContent = `当前第 ${order + 1} 页 / 原第 ${page.index + 1} 页`;
    card.onclick = () => {
      if (state.manage.selected.has(page.id)) state.manage.selected.delete(page.id);
      else state.manage.selected.add(page.id);
      renderManagePages();
    };
    preview.appendChild(card);
  });
  updateSelectionSummary();
}

function rotateSelected(delta) {
  state.manage.pages.forEach((page) => {
    if (state.manage.selected.has(page.id)) page.rotation = (page.rotation + delta + 360) % 360;
  });
  renderManagePages();
}

async function exportManage(btn, selectedOnly) {
  try {
    if (!state.manage.file) throw new Error("请先上传一个 PDF。");
    const pages = selectedOnly ? state.manage.pages.filter((p) => state.manage.selected.has(p.id)) : state.manage.pages;
    if (!pages.length) throw new Error(selectedOnly ? "请先选择要提取的页面。" : "没有可导出的页面。");
    setBusy(btn, true, "正在导出...");
    const bytes = await copySelectedPages(state.manage.file, pages.map((p) => p.index), pages.map((p) => p.rotation));
    showResult("manage", $("#manageDownload"), bytes, buildOutputName(state.manage.file, selectedOnly ? "selected-pages" : "managed"), `${pages.length} 页`);
    showAlert("导出完成，可以下载了。");
  } catch (error) {
    showAlert(friendlyError(error), "error");
  } finally {
    setBusy(btn, false);
  }
}

function initSinglePdfTool(inputId, previewId, stateKey, prop = "file", metaId = "") {
  $(inputId).addEventListener("change", async (event) => {
    handleNewInput(stateKey);
    const file = event.target.files[0];
    state[stateKey][prop] = file;
    if (file) warnLargeFiles([file]);
    if (file && previewId) {
      const count = await renderPreview(file, previewId);
      state[stateKey].pageCount = count;
      if (metaId) renderFileMeta(metaId, file, count ? `${count} 页` : "页数读取失败");
      const largeMap = {
        number: "#numberLargePreview",
        textwatermark: "#textWatermarkLargePreview",
        imagewatermark: "#imageWatermarkLargePreview",
        signature: "#signatureLargePreview",
        annotate: "#annotateLargePreview"
      };
      if (largeMap[stateKey] && count) await loadLargePreview(largeMap[stateKey], file, count);
    }
  });
}

function getScopeIndexes(scopeSelect, rangeInput, total, helpId = "") {
  if ($(scopeSelect).value !== "custom") return Array.from({ length: total }, (_, i) => i);
  try {
    const parsed = parsePageRangeDetailed($(rangeInput).value, total);
    if (helpId) {
      const help = $(helpId);
      help.textContent = parsed.duplicateCount ? `已自动去重 ${parsed.duplicateCount} 个重复页码。` : summarizePages(parsed.numbers);
      help.className = parsed.duplicateCount ? "field-help warn" : "field-help";
    }
    return parsed.indexes;
  } catch (error) {
    if (helpId) {
      const help = $(helpId);
      help.textContent = error.message;
      help.className = "field-help error";
    }
    throw error;
  }
}

function toggleRangeField(selectId, fieldId) {
  const update = () => $(fieldId).classList.toggle("hidden", $(selectId).value !== "custom");
  $(selectId).addEventListener("change", update);
  update();
}

function mapPreviewPointToPdfPoint(card, clientX, clientY, pdfPageWidth, pdfPageHeight, boxWidth = 0, boxHeight = 0) {
  const canvas = card.querySelector("canvas");
  const rect = canvas.getBoundingClientRect();
  const xRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const yRatio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  return {
    x: Math.round(xRatio * pdfPageWidth - boxWidth / 2),
    y: Math.round((1 - yRatio) * pdfPageHeight - boxHeight / 2)
  };
}

function setPlacementBox(containerSelector, pageNo, x, y, w, h, pdfW, pdfH, onMove) {
  const card = $(`${containerSelector} .thumb[data-page="${pageNo - 1}"]`);
  if (!card) return;
  let wrap = card.querySelector(".thumb-canvas-wrap");
  const canvas = card.querySelector("canvas");
  if (canvas && !wrap) {
    wrap = document.createElement("div");
    wrap.className = "thumb-canvas-wrap";
    canvas.before(wrap);
    wrap.appendChild(canvas);
  }
  if (!wrap) return;
  $$(containerSelector + " .placement-box").forEach((box) => box.remove());
  const box = document.createElement("div");
  box.className = "placement-box";
  box.style.left = `${(x / pdfW) * 100}%`;
  box.style.top = `${((pdfH - y - h) / pdfH) * 100}%`;
  box.style.width = `${(w / pdfW) * 100}%`;
  box.style.height = `${(h / pdfH) * 100}%`;
  wrap.appendChild(box);
  let dragging = false;
  const move = (event) => {
    if (!dragging) return;
    event.preventDefault();
    const point = event.touches ? event.touches[0] : event;
    const rect = wrap.getBoundingClientRect();
    const nx = Math.max(0, Math.min(rect.width, point.clientX - rect.left));
    const ny = Math.max(0, Math.min(rect.height, point.clientY - rect.top));
    onMove(mapPreviewPointToPdfPoint(card, rect.left + nx, rect.top + ny, pdfW, pdfH, w, h));
  };
  box.addEventListener("mousedown", (event) => { dragging = true; event.preventDefault(); });
  box.addEventListener("touchstart", (event) => { dragging = true; event.preventDefault(); }, { passive: false });
  window.addEventListener("mousemove", move);
  window.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("mouseup", () => { dragging = false; });
  window.addEventListener("touchend", () => { dragging = false; });
}

async function initNumber() {
  initSinglePdfTool("#numberFile", "#numberPreview", "number", "file", "#numberMeta");
  toggleRangeField("#numberScope", "#numberRangeField");
  ["numberPosition", "numberStart", "numberSize", "numberColor", "numberMargin", "numberFormat"].forEach((id) => $(`#${id}`).addEventListener("input", updateNumberOverlay));
  $("#numberBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (!state.number.file) throw new Error("请先上传一个 PDF。");
      setBusy(btn, true, "正在添加...");
      const pdf = await loadPdfLib(state.number.file);
      const pages = pdf.getPages();
      const size = Number($("#numberSize").value || 12);
      const start = Number($("#numberStart").value || 1);
      if (start < 0) throw new Error("起始页码不能小于 0。");
      const indexes = getScopeIndexes("#numberScope", "#numberRange", pages.length, "#numberRangeHelp");
      for (let order = 0; order < indexes.length; order += 1) {
        const i = indexes[order];
        const current = start + order;
        const format = $("#numberFormat").value;
        const text = format === "cn" ? `第 ${current} 页`
          : format === "cn-total" ? `第 ${current} / ${pages.length} 页`
            : format === "page-en" ? `Page ${current}`
              : format === "page-en-total" ? `Page ${current} of ${pages.length}`
                : format === "total" ? `${current} / ${pages.length}` : String(current);
        const img = await embedImage(pdf, createTextPng(text, { size, color: $("#numberColor").value }));
        const dims = img.scale(0.5);
        const [x, y] = placeInPage(pages[i], dims.width, dims.height, $("#numberPosition").value, Number($("#numberMargin").value || 28));
        pages[i].drawImage(img, { x, y, width: dims.width, height: dims.height });
      }
      const bytes = await pdf.save();
      showResult("number", $("#numberDownload"), bytes, buildOutputName(state.number.file, "page-numbers"), `添加 ${indexes.length} 页页码`);
      showAlert(`页码已添加到 ${indexes.length} 页。`);
    } catch (error) {
      showAlert(friendlyError(error), "error");
    } finally {
      setBusy(btn, false);
    }
  });
}

async function initTextWatermark() {
  initSinglePdfTool("#textWatermarkFile", "#textWatermarkPreview", "textwatermark", "file", "#textWatermarkMeta");
  toggleRangeField("#watermarkScope", "#watermarkRangeField");
  const updateSummary = () => {
    $("#watermarkSummary").textContent = `文字：${$("#watermarkText").value || "未填写"} · 位置：${$("#watermarkPosition").selectedOptions[0].textContent} · 透明度：${$("#watermarkOpacity").value} · 旋转：${$("#watermarkRotate").value}° · 应用范围：${$("#watermarkScope").value === "all" ? "全部页面" : "指定页码"}`;
  };
  ["watermarkText", "watermarkPosition", "watermarkOpacity", "watermarkRotate", "watermarkScope"].forEach((id) => $(`#${id}`).addEventListener("input", updateSummary));
  ["watermarkText", "watermarkSize", "watermarkOpacity", "watermarkRotate", "watermarkColor", "watermarkPosition"].forEach((id) => $(`#${id}`).addEventListener("input", updateTextWatermarkOverlay));
  updateSummary();
  $("#textWatermarkBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (!state.textwatermark.file) throw new Error("请先上传一个 PDF。");
      const text = $("#watermarkText").value.trim();
      if (!text) throw new Error("请输入水印文字。");
      setBusy(btn, true, "正在添加...");
      const pdf = await loadPdfLib(state.textwatermark.file);
      const indexes = getScopeIndexes("#watermarkScope", "#watermarkRange", pdf.getPageCount(), "#watermarkRangeHelp");
      const img = await embedImage(pdf, createTextPng(text, {
        size: Number($("#watermarkSize").value),
        color: $("#watermarkColor").value,
        opacity: Number($("#watermarkOpacity").value)
      }));
      for (const pageIndex of indexes) {
        const page = pdf.getPage(pageIndex);
        const { width, height } = page.getSize();
        const dims = img.scale(Math.min(width / img.width, 1));
        const position = $("#watermarkPosition").value;
        const draw = (x, y) => page.drawImage(img, { x, y, width: dims.width, height: dims.height, rotate: degrees(Number($("#watermarkRotate").value)) });
        if (position === "tile") {
          for (let x = -width * 0.2; x < width; x += dims.width * 1.25) {
            for (let y = 0; y < height; y += dims.height * 2) draw(x, y);
          }
        } else {
          draw(...placeInPage(page, dims.width, dims.height, position, 42));
        }
      }
      const bytes = await pdf.save();
      showResult("textwatermark", $("#textWatermarkDownload"), bytes, buildOutputName(state.textwatermark.file, "text-watermark"), `水印已添加到 ${indexes.length} 页`);
      showAlert(`水印已添加到 ${indexes.length} 页。`);
    } catch (error) {
      showAlert(friendlyError(error), "error");
    } finally {
      setBusy(btn, false);
    }
  });
}

async function initImageWatermark() {
  initSinglePdfTool("#imageWatermarkPdf", "#imageWatermarkPreview", "imagewatermark", "pdf", "#imageWatermarkMeta");
  toggleRangeField("#imageWatermarkScope", "#imageWatermarkRangeField");
  const updateSummary = () => {
    const percent = Math.round(Number($("#imageWatermarkScale").value || 0.35) * 100);
    $("#imageWatermarkScaleValue").textContent = `${percent}%`;
    $("#imageWatermarkSummary").textContent = `图片：${state.imagewatermark.image?.name || "未选择"} · 宽度：${percent}% · 位置：${$("#imageWatermarkPosition").selectedOptions[0].textContent} · 透明度：${$("#imageWatermarkOpacity").value} · 旋转：${$("#imageWatermarkRotate").value}° · 应用范围：${$("#imageWatermarkScope").value === "all" ? "全部页面" : "指定页码"}`;
  };
  ["imageWatermarkPosition", "imageWatermarkOpacity", "imageWatermarkRotate", "imageWatermarkScope"].forEach((id) => $(`#${id}`).addEventListener("input", updateSummary));
  ["imageWatermarkPosition", "imageWatermarkOpacity", "imageWatermarkRotate", "imageWatermarkScale"].forEach((id) => $(`#${id}`).addEventListener("input", () => {
    updateSummary();
    updateImageWatermarkOverlay();
  }));
  $("#imageWatermarkImage").addEventListener("change", (event) => {
    handleNewInput("imagewatermark");
    if (state.imagewatermark.previewUrl) URL.revokeObjectURL(state.imagewatermark.previewUrl);
    state.imagewatermark.image = event.target.files[0];
    state.imagewatermark.previewUrl = state.imagewatermark.image ? URL.createObjectURL(state.imagewatermark.image) : null;
    state.imagewatermark.imageSize = null;
    if (state.imagewatermark.previewUrl) {
      const img = new Image();
      img.onload = () => {
        state.imagewatermark.imageSize = { width: img.naturalWidth, height: img.naturalHeight };
        updateImageWatermarkOverlay();
      };
      img.src = state.imagewatermark.previewUrl;
    }
    updateSummary();
    updateImageWatermarkOverlay();
  });
  updateSummary();
  $("#imageWatermarkBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (!state.imagewatermark.pdf || !state.imagewatermark.image) throw new Error("请上传 PDF 和水印图片。");
      setBusy(btn, true, "正在添加...");
      const pdf = await loadPdfLib(state.imagewatermark.pdf);
      const indexes = getScopeIndexes("#imageWatermarkScope", "#imageWatermarkRange", pdf.getPageCount(), "#imageWatermarkRangeHelp");
      const img = await embedImage(pdf, state.imagewatermark.image);
      for (const pageIndex of indexes) {
        const page = pdf.getPage(pageIndex);
        const layout = computeImageWatermarkLayout({
          pageWidth: page.getWidth(),
          pageHeight: page.getHeight(),
          imageWidth: img.width,
          imageHeight: img.height,
          scaleRatio: $("#imageWatermarkScale").value,
          position: $("#imageWatermarkPosition").value,
          margin: 40,
          rotate: $("#imageWatermarkRotate").value
        });
        page.drawImage(img, { x: layout.x, y: layout.y, width: layout.width, height: layout.height, opacity: Number($("#imageWatermarkOpacity").value), rotate: degrees(layout.rotate) });
      }
      const bytes = await pdf.save();
      showResult("imagewatermark", $("#imageWatermarkDownload"), bytes, buildOutputName(state.imagewatermark.pdf, "image-watermark"), `水印已添加到 ${indexes.length} 页`);
      showAlert(`水印已添加到 ${indexes.length} 页。`);
    } catch (error) {
      showAlert(friendlyError(error), "error");
    } finally {
      setBusy(btn, false);
    }
  });
}

function initSignaturePad() {
  const canvas = $("#signaturePad");
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#111827";
  const pos = (event) => {
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return { x: (point.clientX - rect.left) * (canvas.width / rect.width), y: (point.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (event) => { event.preventDefault(); state.signature.drawing = true; state.signature.hasDrawing = true; const p = pos(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (event) => { if (!state.signature.drawing) return; event.preventDefault(); const p = pos(event); ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const end = () => { state.signature.drawing = false; };
  ["mousedown", "touchstart"].forEach((name) => canvas.addEventListener(name, start, { passive: false }));
  ["mousemove", "touchmove"].forEach((name) => canvas.addEventListener(name, move, { passive: false }));
  ["mouseup", "mouseleave", "touchend"].forEach((name) => canvas.addEventListener(name, end));
  $("#signatureClearPad").addEventListener("click", () => { ctx.clearRect(0, 0, canvas.width, canvas.height); state.signature.hasDrawing = false; });
}

async function initSignature() {
  initSignaturePad();
  initSinglePdfTool("#signaturePdf", "#signaturePreview", "signature", "pdf", "#signatureMeta");
  $("#signatureImage").addEventListener("change", (event) => {
    handleNewInput("signature");
    state.signature.image = event.target.files[0];
  });
  $("#signatureWidth").addEventListener("input", () => {
    $("#signatureWidthRange").value = $("#signatureWidth").value;
    updateSignaturePlacement();
  });
  $("#signatureWidthRange").addEventListener("input", () => {
    $("#signatureWidth").value = $("#signatureWidthRange").value;
    updateSignaturePlacement();
  });
  $("#signaturePage").addEventListener("input", updateSignaturePlacement);
  ["signatureX", "signatureY"].forEach((id) => $(`#${id}`).addEventListener("input", updateSignaturePlacement));
  $("#signaturePreview").addEventListener("click", (event) => {
    const card = event.target.closest(".thumb");
    if (!card || event.target.classList.contains("placement-box")) return;
    const canvas = card.querySelector("canvas");
    const pageNo = Number(card.dataset.page) + 1;
    const pdfW = Number(canvas.dataset.pdfWidth);
    const pdfH = Number(canvas.dataset.pdfHeight);
    const w = Number($("#signatureWidth").value);
    const h = Math.max(28, w * 0.35);
    const point = mapPreviewPointToPdfPoint(card, event.clientX, event.clientY, pdfW, pdfH, w, h);
    $("#signaturePage").value = pageNo;
    $("#signatureX").value = Math.max(0, point.x);
    $("#signatureY").value = Math.max(0, point.y);
    updateSignaturePlacement();
  });
  $("#signatureBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (!state.signature.pdf) throw new Error("请先上传一个 PDF。");
      if (!state.signature.image && !state.signature.hasDrawing) throw new Error("请上传签名图片，或在画布中手写签名。");
      setBusy(btn, true, "正在添加...");
      const pdf = await loadPdfLib(state.signature.pdf);
      const pageNo = Number($("#signaturePage").value);
      if (pageNo < 1 || pageNo > pdf.getPageCount()) throw new Error(`签名页码超出范围。当前 PDF 共 ${pdf.getPageCount()} 页。`);
      const data = state.signature.image || $("#signaturePad").toDataURL("image/png");
      const img = await embedImage(pdf, data);
      const page = pdf.getPage(pageNo - 1);
      const width = Number($("#signatureWidth").value);
      const height = width * (img.height / img.width);
      page.drawImage(img, { x: Number($("#signatureX").value), y: Number($("#signatureY").value), width, height });
      const bytes = await pdf.save();
      showResult("signature", $("#signatureDownload"), bytes, buildOutputName(state.signature.pdf, "signed"), `签名已添加到第 ${pageNo} 页`);
      showAlert("签名添加完成。");
    } catch (error) {
      showAlert(friendlyError(error), "error");
    } finally {
      setBusy(btn, false);
    }
  });
}

function updateSignaturePlacement() {
  const pageNo = Number($("#signaturePage").value || 1);
  const large = largePreviews.get("#signatureLargePreview");
  if (large?.file) {
    if (large.pageNumber !== pageNo && pageNo >= 1 && pageNo <= large.totalPages) {
      setLargePreviewPage("#signatureLargePreview", pageNo);
      return;
    }
    const w = Number($("#signatureWidth").value || 160);
    const h = Math.max(28, w * 0.35);
    placeOverlayBox("#signatureLargePreview", Number($("#signatureX").value || 0), Number($("#signatureY").value || 0), w, h, "", (point) => {
      $("#signatureX").value = Math.max(0, point.x);
      $("#signatureY").value = Math.max(0, point.y);
    });
  }
  const card = $(`#signaturePreview .thumb[data-page="${pageNo - 1}"]`);
  if (!card) return;
  const canvas = card.querySelector("canvas");
  const pdfW = Number(canvas.dataset.pdfWidth);
  const pdfH = Number(canvas.dataset.pdfHeight);
  const w = Number($("#signatureWidth").value || 160);
  const h = Math.max(28, w * 0.35);
  setPlacementBox("#signaturePreview", pageNo, Number($("#signatureX").value || 0), Number($("#signatureY").value || 0), w, h, pdfW, pdfH, (point) => {
    $("#signatureX").value = Math.max(0, point.x);
    $("#signatureY").value = Math.max(0, point.y);
    updateSignaturePlacement();
  });
}

async function initAnnotate() {
  initSinglePdfTool("#annotatePdf", "#annotatePreview", "annotate", "pdf", "#annotateMeta");
  const updateButton = () => {
    $("#annotateBtn").disabled = $("#annotateType").value === "image" && !state.annotate.image;
  };
  $("#annotateImage").addEventListener("change", (event) => {
    handleNewInput("annotate");
    state.annotate.image = event.target.files[0];
    updateButton();
  });
  $("#annotateType").addEventListener("change", () => {
    updateButton();
    updateAnnotatePlacement();
  });
  ["annotatePage", "annotateX", "annotateY", "annotateW", "annotateH", "annotateText"].forEach((id) => $(`#${id}`).addEventListener("input", updateAnnotatePlacement));
  $("#annotatePreview").addEventListener("click", (event) => {
    const card = event.target.closest(".thumb");
    if (!card || event.target.classList.contains("placement-box")) return;
    const canvas = card.querySelector("canvas");
    const pageNo = Number(card.dataset.page) + 1;
    const pdfW = Number(canvas.dataset.pdfWidth);
    const pdfH = Number(canvas.dataset.pdfHeight);
    const w = Number($("#annotateW").value || 120);
    const h = Number($("#annotateH").value || 60);
    const point = mapPreviewPointToPdfPoint(card, event.clientX, event.clientY, pdfW, pdfH, w, h);
    $("#annotatePage").value = pageNo;
    $("#annotateX").value = Math.max(0, point.x);
    $("#annotateY").value = Math.max(0, point.y);
    updateAnnotatePlacement();
  });
  updateButton();
  $("#annotateBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (!state.annotate.pdf) throw new Error("请先上传一个 PDF。");
      setBusy(btn, true, "正在添加...");
      const pdf = await loadPdfLib(state.annotate.pdf);
      const pageNo = Number($("#annotatePage").value);
      if (pageNo < 1 || pageNo > pdf.getPageCount()) throw new Error(`页码超出范围。当前 PDF 共 ${pdf.getPageCount()} 页。`);
      const page = pdf.getPage(pageNo - 1);
      const type = $("#annotateType").value;
      const x = Number($("#annotateX").value), y = Number($("#annotateY").value), w = Number($("#annotateW").value), h = Number($("#annotateH").value);
      const color = colorToRgb($("#annotateColor").value);
      if (type === "text") {
        const img = await embedImage(pdf, createTextPng($("#annotateText").value || "备注", { size: Number($("#annotateSize").value), color: $("#annotateColor").value }));
        page.drawImage(img, { x, y, width: w, height: w * (img.height / img.width) });
      } else if (type === "rect") page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: 2 });
      else if (type === "circle") page.drawEllipse({ x: x + w / 2, y: y + h / 2, xScale: w / 2, yScale: h / 2, borderColor: color, borderWidth: 2 });
      else if (type === "line") page.drawLine({ start: { x, y }, end: { x: x + w, y: y + h }, color, thickness: 2 });
      else {
        if (!state.annotate.image) throw new Error("请选择要添加的图片。");
        const img = await embedImage(pdf, state.annotate.image);
        page.drawImage(img, { x, y, width: w, height: h });
      }
      const bytes = await pdf.save();
      showResult("annotate", $("#annotateDownload"), bytes, buildOutputName(state.annotate.pdf, "annotated"), `标注已添加到第 ${pageNo} 页`);
      showAlert("标注添加完成。");
    } catch (error) {
      showAlert(friendlyError(error), "error");
    } finally {
      setBusy(btn, false);
    }
  });
}

function updateAnnotatePlacement() {
  const pageNo = Number($("#annotatePage").value || 1);
  const large = largePreviews.get("#annotateLargePreview");
  if (large?.file) {
    if (large.pageNumber !== pageNo && pageNo >= 1 && pageNo <= large.totalPages) {
      setLargePreviewPage("#annotateLargePreview", pageNo);
      return;
    }
    const type = $("#annotateType").value;
    const className = type === "circle" ? "annotate-circle-preview" : type === "line" ? "annotate-line-preview" : "";
    placeOverlayBox("#annotateLargePreview", Number($("#annotateX").value || 0), Number($("#annotateY").value || 0), Number($("#annotateW").value || 120), Number($("#annotateH").value || 60), className, (point) => {
      $("#annotateX").value = Math.max(0, point.x);
      $("#annotateY").value = Math.max(0, point.y);
    });
    const box = $("#annotateLargePreview .placement-box");
    if (box && type === "text") box.textContent = $("#annotateText").value || "文字";
    if (box && type === "image") box.textContent = "图片";
  }
  const card = $(`#annotatePreview .thumb[data-page="${pageNo - 1}"]`);
  if (!card) return;
  const canvas = card.querySelector("canvas");
  const pdfW = Number(canvas.dataset.pdfWidth);
  const pdfH = Number(canvas.dataset.pdfHeight);
  const w = Number($("#annotateW").value || 120);
  const h = Number($("#annotateH").value || 60);
  setPlacementBox("#annotatePreview", pageNo, Number($("#annotateX").value || 0), Number($("#annotateY").value || 0), w, h, pdfW, pdfH, (point) => {
    $("#annotateX").value = Math.max(0, point.x);
    $("#annotateY").value = Math.max(0, point.y);
    updateAnnotatePlacement();
  });
}

function overlayRectForPosition(preview, boxW, boxH, position, margin = 36) {
  const map = {
    center: [(preview.pdfWidth - boxW) / 2, (preview.pdfHeight - boxH) / 2],
    "top-left": [margin, preview.pdfHeight - boxH - margin],
    "bottom-right": [preview.pdfWidth - boxW - margin, margin],
    "bottom-center": [(preview.pdfWidth - boxW) / 2, margin],
    "bottom-left": [margin, margin],
    "top-center": [(preview.pdfWidth - boxW) / 2, preview.pdfHeight - boxH - margin],
    "top-right": [preview.pdfWidth - boxW - margin, preview.pdfHeight - boxH - margin]
  };
  return map[position] || map.center;
}

function setOverlayElement(containerId, el, x, y, w, h) {
  const preview = largePreviews.get(containerId);
  const overlay = preview?.container.querySelector(".large-preview-overlay");
  if (!preview || !overlay) return;
  overlay.innerHTML = "";
  el.style.left = `${(x / preview.pdfWidth) * 100}%`;
  el.style.top = `${((preview.pdfHeight - y - h) / preview.pdfHeight) * 100}%`;
  el.style.width = `${(w / preview.pdfWidth) * 100}%`;
  el.style.height = `${(h / preview.pdfHeight) * 100}%`;
  overlay.appendChild(el);
}

function updateTextWatermarkOverlay() {
  const preview = largePreviews.get("#textWatermarkLargePreview");
  if (!preview?.file || !preview.pdfWidth) return;
  const overlay = preview.container.querySelector(".large-preview-overlay");
  if (!overlay) return;
  overlay.innerHTML = "";
  const text = $("#watermarkText").value || "水印";
  const opacity = $("#watermarkOpacity").value;
  const rotate = $("#watermarkRotate").value;
  const size = Math.max(18, Number($("#watermarkSize").value || 42) * 0.9);
  const make = () => {
    const el = document.createElement("div");
    el.className = "watermark-preview";
    el.textContent = text;
    el.style.color = $("#watermarkColor").value;
    el.style.opacity = opacity;
    el.style.fontSize = `${size}px`;
    el.style.transform = `rotate(${rotate}deg)`;
    return el;
  };
  if ($("#watermarkPosition").value === "tile") {
    const tile = document.createElement("div");
    tile.className = "watermark-tile";
    for (let i = 0; i < 9; i += 1) tile.appendChild(make());
    overlay.appendChild(tile);
    return;
  }
  const w = Math.min(preview.pdfWidth * 0.75, text.length * size);
  const h = size * 1.6;
  const [x, y] = overlayRectForPosition(preview, w, h, $("#watermarkPosition").value, 42);
  setOverlayElement("#textWatermarkLargePreview", make(), x, y, w, h);
}

function updateImageWatermarkOverlay() {
  const preview = largePreviews.get("#imageWatermarkLargePreview");
  if (!preview?.file || !preview.pdfWidth) return;
  const imgFile = state.imagewatermark.image;
  const el = document.createElement("div");
  el.className = "watermark-preview";
  el.textContent = imgFile ? imgFile.name : "图片水印";
  if (state.imagewatermark.previewUrl) {
    el.textContent = "";
    el.style.backgroundImage = `url("${state.imagewatermark.previewUrl}")`;
    el.style.backgroundSize = "contain";
    el.style.backgroundRepeat = "no-repeat";
    el.style.backgroundPosition = "center";
  }
  el.style.opacity = $("#imageWatermarkOpacity").value;
  el.style.transform = `rotate(${Number($("#imageWatermarkRotate").value || 0)}deg)`;
  const size = state.imagewatermark.imageSize || {};
  const layout = computeImageWatermarkLayout({
    pageWidth: preview.pdfWidth,
    pageHeight: preview.pdfHeight,
    imageWidth: size.width,
    imageHeight: size.height,
    scaleRatio: $("#imageWatermarkScale").value,
    position: $("#imageWatermarkPosition").value,
    margin: 40,
    rotate: $("#imageWatermarkRotate").value
  });
  setOverlayElement("#imageWatermarkLargePreview", el, layout.x, layout.y, layout.width, layout.height);
}

function updateNumberOverlay() {
  const preview = largePreviews.get("#numberLargePreview");
  if (!preview?.file || !preview.pdfWidth) return;
  const pageOffset = Math.max(0, preview.pageNumber - 1);
  const current = Number($("#numberStart").value || 1) + pageOffset;
  const total = preview.totalPages || 1;
  const format = $("#numberFormat").value;
  const text = format === "cn" ? `第 ${current} 页`
    : format === "cn-total" ? `第 ${current} / ${total} 页`
      : format === "page-en" ? `Page ${current}`
        : format === "page-en-total" ? `Page ${current} of ${total}`
          : format === "total" ? `${current} / ${total}` : String(current);
  const el = document.createElement("div");
  el.className = "page-number-preview";
  el.textContent = text;
  el.style.color = $("#numberColor").value;
  el.style.fontSize = `${Number($("#numberSize").value || 12) * 1.1}px`;
  const w = Math.max(42, text.length * Number($("#numberSize").value || 12) * 0.7);
  const h = Number($("#numberSize").value || 12) * 1.7;
  const [x, y] = overlayRectForPosition(preview, w, h, $("#numberPosition").value, Number($("#numberMargin").value || 28));
  setOverlayElement("#numberLargePreview", el, x, y, w, h);
}

function initPermissions() {
  $("#permissionFile").addEventListener("change", async (event) => {
    handleNewInput("permissions");
    const file = event.target.files[0];
    state.permissions.file = file || null;
    state.permissions.info = null;
    if (!file) return;
    warnLargeFiles([file]);
    renderFileMeta("#permissionMeta", file);
    $("#permissionPreviewNote").textContent = "已选择文件，点击“检测权限”查看结果。";
  });

  $("#permissionBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (!state.permissions.file) throw new Error("请先上传一个 PDF。");
      setBusy(btn, true, "正在检测...");
      const info = await detectPdfPermissions(state.permissions.file);
      state.permissions.info = info;
      const result = $("#permissionsResult");
      const qpdfRows = [
        ["QPDF 模块状态", info.qpdf.available ? "可用" : "未启用"],
        ["文件是否加密", info.qpdf.encrypted === null ? "未知" : info.qpdf.encrypted ? "受限" : "允许"],
        ["是否需要打开密码", info.qpdf.needsPassword === null ? "未知" : info.qpdf.needsPassword ? "受限" : "允许"],
        ["是否存在 owner permission 限制", info.qpdf.ownerRestricted === null ? "未知" : info.qpdf.ownerRestricted ? "受限" : "允许"],
        ["是否可生成普通副本", info.qpdf.canMakeNormalCopy ? "允许" : info.qpdf.available ? "受限" : "未知"]
      ];
      result.innerHTML = `
        <strong>检测完成</strong>
        <p>${escapeHTML(state.permissions.file.name)} · ${info.pageCount || "未知"} 页 · ${escapeHTML(info.canPreview ? "可以预览" : info.previewError)}</p>
        ${renderStatusRows(info.rows)}
        <p><strong>QPDF 检测结果</strong></p>
        ${renderStatusRows(qpdfRows)}
        ${info.qpdf.error ? `<p>${escapeHTML(info.qpdf.error)}</p>` : ""}
        <p>能打开查看不代表一定能编辑。</p>
        ${info.qpdf.available ? "<p>不同引擎对 PDF 权限的识别可能不同，请以实际处理结果为准。</p>" : ""}
        ${info.mayHaveSignature ? "<p>此 PDF 可能包含数字签名，修改后可能导致签名失效。</p>" : ""}
        ${info.canPreview && !info.editableByPdfLib ? "<p>此 PDF 可以预览，但无法被当前编辑引擎修改。它可能设置了权限保护、编辑限制、数字签名、表单保护或特殊 PDF 结构。</p>" : ""}
      `;
      result.classList.remove("hidden");
      result.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      showAlert(friendlyError(error), "error");
    } finally {
      setBusy(btn, false);
    }
  });
}

async function rebuildPdfAsImages(file, options = {}) {
  const pdf = await getPdfJsDocumentWithPassword(file, options.password || "");
  const rangeText = (options.range || "").trim();
  const pageIndexes = rangeText ? parsePageRange(rangeText, pdf.numPages) : Array.from({ length: pdf.numPages }, (_, i) => i);
  const requestedScale = Number(options.scale || 1.5);
  const format = options.format === "png" ? "png" : "jpeg";
  const jpegQuality = Number(options.jpegQuality || 0.92);
  const maxPixels = 24_000_000;
  const out = await PDFDocument.create();
  for (const pageIndex of pageIndexes) {
    const page = await pdf.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1 });
    const pixelCount = base.width * requestedScale * base.height * requestedScale;
    const scale = pixelCount > maxPixels ? Math.sqrt(maxPixels / (base.width * base.height)) : requestedScale;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const dataUrl = format === "png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", jpegQuality);
    const img = await embedImage(out, dataUrl);
    const outPage = out.addPage([viewport.width / scale, viewport.height / scale]);
    outPage.drawImage(img, { x: 0, y: 0, width: outPage.getWidth(), height: outPage.getHeight() });
    canvas.width = 1;
    canvas.height = 1;
  }
  return { bytes: await out.save(), pageCount: pageIndexes.length };
}

function initNormalCopy() {
  $("#normalCopyFile").addEventListener("change", async (event) => {
    handleNewInput("normalcopy");
    const file = event.target.files[0];
    state.normalcopy.file = file || null;
    state.normalcopy.pageCount = 0;
    if (!file) return;
    warnLargeFiles([file]);
    renderFileMeta("#normalCopyMeta", file);
    try {
      const info = await detectPdfPermissions(file);
      state.normalcopy.pageCount = info.pageCount || 0;
      $("#normalCopyStatus").innerHTML = `${escapeHTML(info.canPreview ? `可预览，共 ${info.pageCount} 页。` : info.previewError)}<br>为了避免浏览器卡顿，大预览每次只渲染当前页；图片化重建请尽量选择页码范围。`;
    } catch (error) {
      $("#normalCopyStatus").textContent = friendlyError(error);
    }
  });

  $("#normalCopyBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (!state.normalcopy.file) throw new Error("请先上传一个 PDF。");
      if (!$("#normalCopyConsent").checked) throw new Error("请先确认这是你拥有权利或已获得授权处理的 PDF 文件。");
      setBusy(btn, true, "正在生成...");
      try {
        const bytes = await window.PdfQpdf.makeNormalCopy(await bytesFromFile(state.normalcopy.file), {
          password: $("#normalCopyPassword").value,
          removeRestrictions: true,
          preserveMetadata: true
        });
        showResult("normalcopy", $("#normalCopyDownload"), bytes, buildOutputName(state.normalcopy.file, "normal-copy"), state.normalcopy.pageCount ? `${state.normalcopy.pageCount} 页` : "");
        showAlert("已生成普通副本。你可以继续使用合并、拆分、水印、签名等工具处理这个新 PDF。");
      } catch (qpdfError) {
        const message = friendlyError(qpdfError);
        if (/模块文件不存在|未启用|MIME|WebAssembly|qpdf API|初始化失败/i.test(message)) {
          try {
            const pdf = await PDFDocument.load(await bytesFromFile(state.normalcopy.file));
            const bytes = await pdf.save();
            showResult("normalcopy", $("#normalCopyDownload"), bytes, buildOutputName(state.normalcopy.file, "normal-copy"), state.normalcopy.pageCount ? `${state.normalcopy.pageCount} 页，普通重保存，不等于权限修复` : "普通重保存，不等于权限修复");
            showAlert("当前未启用 QPDF 权限修复模块。此文件可被 pdf-lib 读取，已生成普通重保存副本；这不等于真正的权限修复。", "warn");
          } catch (_fallbackError) {
            showNormalCopyFallback(message);
          }
          return;
        }
        showNormalCopyFallback(message);
      }
    } catch (error) {
      showAlert(friendlyError(error), "error");
    } finally {
      setBusy(btn, false);
    }
  });

  $("#rebuildCopyBtn").addEventListener("click", async (event) => {
    const run = async () => {
      const btn = event.currentTarget;
      try {
        if (!state.normalcopy.file) throw new Error("请先上传一个 PDF。");
        if (!$("#normalCopyConsent").checked) throw new Error("请先确认这是你拥有权利或已获得授权处理的 PDF 文件。");
        setBusy(btn, true, "正在重建...");
        const result = await rebuildPdfAsImages(state.normalcopy.file, {
          password: $("#normalCopyPassword").value,
          range: $("#rebuildRange").value,
          scale: $("#rebuildQuality").value,
          format: $("#rebuildFormat").value,
          jpegQuality: $("#rebuildJpegQuality").value
        });
        showResult("normalcopy", $("#normalCopyDownload"), result.bytes, buildOutputName(state.normalcopy.file, "rebuilt"), `${result.pageCount} 页，文字不可复制`);
        showAlert("图片化重建后文字不可复制，文件可能变大，打印清晰度取决于所选档位。");
      } catch (error) {
        showAlert(friendlyError(error), "error");
      } finally {
        setBusy(btn, false);
      }
    };
    const total = state.normalcopy.pageCount || 0;
    let rebuildCount = total;
    try {
      if ($("#rebuildRange").value.trim() && total) rebuildCount = parsePageRange($("#rebuildRange").value, total).length;
    } catch (_error) {
      rebuildCount = total;
    }
    const printGrade = Number($("#rebuildQuality").value) >= 3.5;
    if ((!$("#rebuildRange").value.trim() && total > 30) || (printGrade && rebuildCount > 20)) {
      showConfirm({
        title: "确认图片化重建",
        message: printGrade ? "打印级重建会显著增加文件体积和处理时间。" : `即将重建 ${total} 页，可能很慢且文件会变大。重建后文字不可选择。`,
        confirmText: "继续重建"
      }, run);
    } else {
      run();
    }
  });
}

function showNormalCopyFallback(message) {
  const result = $("#normalcopyResult");
  result.innerHTML = `
    <strong>无法直接生成普通副本</strong>
    <p>${escapeHTML(message || "当前未启用 QPDF 权限修复模块，无法直接生成普通副本。你可以部署 qpdf-wasm 后启用此能力，或使用图片化重建副本作为兜底方案。")}</p>
    <p>图片化重建后文字不可复制，文件可能变大。</p>
    <div class="button-row">
      <button class="primary-btn" type="button" data-use-rebuild>使用图片化重建副本</button>
    </div>
  `;
  result.classList.remove("hidden");
  result.querySelector("[data-use-rebuild]").addEventListener("click", () => $("#rebuildCopyBtn").click());
  result.scrollIntoView({ behavior: "smooth", block: "center" });
}

function passwordStrengthText(password) {
  if (!password) return "密码强度：未填写";
  if (password.length < 8) return "密码强度：太短";
  if (password.length >= 12 && /[a-z]/i.test(password) && /\d/.test(password) && /[^a-z0-9]/i.test(password)) return "密码强度：较强";
  return "密码强度：一般";
}

function initProtect() {
  $("#protectFile").addEventListener("change", (event) => {
    handleNewInput("protect");
    const file = event.target.files[0];
    state.protect.file = file || null;
    if (file) {
      warnLargeFiles([file]);
      renderFileMeta("#protectMeta", file);
    }
  });
  $("#protectUserPassword").addEventListener("input", () => {
    $("#passwordStrength").textContent = passwordStrengthText($("#protectUserPassword").value);
  });
  $("#protectBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (!state.protect.file) throw new Error("请先上传一个 PDF。");
      const userPassword = $("#protectUserPassword").value;
      if (!userPassword) throw new Error("请设置打开密码。");
      if (userPassword !== $("#protectConfirmPassword").value) throw new Error("两次输入的打开密码不一致。");
      if (!$("#protectConsent").checked) throw new Error("请先确认这是你拥有权利或已获得授权处理的 PDF 文件。");
      const run = async () => {
        setBusy(btn, true, "正在加密...");
        if (!window.PdfQpdf?.isAvailable()) {
          await window.PdfQpdf.loadQpdfModule();
        }
        const bytes = await window.PdfQpdf.encryptPdf(await bytesFromFile(state.protect.file), {
          userPassword,
          ownerPassword: $("#protectOwnerPassword").value,
          permissions: {
            print: $("#permPrint").checked,
            copy: $("#permCopy").checked,
            modify: $("#permModify").checked,
            annotate: $("#permAnnotate").checked,
            forms: $("#permForms").checked,
            extract: $("#permExtract").checked
          }
        });
        showResult("protect", $("#protectDownload"), bytes, buildOutputName(state.protect.file, "protected"));
        showAlert("加密 PDF 已生成。建议重新上传 protected.pdf 到“PDF 权限检测”工具确认状态。");
      };
      showConfirm({
        title: "确认密码风险",
        message: "请妥善保存密码。忘记打开密码后，本工具不会帮你破解。",
        confirmText: "生成加密 PDF"
      }, () => run().catch((error) => {
        const message = friendlyError(error);
        if (/模块文件不存在|MIME|WebAssembly|qpdf API|初始化失败/i.test(message)) {
          showAlert("当前未启用 QPDF 加密模块。请按 README 部署 qpdf-wasm 后使用。", "error");
        } else {
          showAlert(message, "error");
        }
      }).finally(() => setBusy(btn, false)));
    } catch (error) {
      showAlert(friendlyError(error), "error");
      setBusy(btn, false);
    }
  });
}

function formatPdfDate(value) {
  if (!value) return "空";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toLocaleString();
  return String(value);
}

function metadataTextProbe(bytes) {
  const text = new TextDecoder("latin1").decode(bytes.slice(0, Math.min(bytes.length, 4_000_000)));
  return {
    xmp: /\/Metadata\b|\/Subtype\s*\/XML\b|<x:xmpmeta|<rdf:RDF/i.test(text),
    signature: /\/ByteRange\b|\/Sig\b|\/DocMDP\b|\/FieldMDP\b/i.test(text),
    annotations: /\/Annots\b/i.test(text),
    forms: /\/AcroForm\b/i.test(text),
    attachments: /\/EmbeddedFiles\b|\/Names\b[^>]*\/EmbeddedFiles\b/i.test(text),
    javascript: /\/JavaScript\b|\/JS\b|\/OpenAction\b/i.test(text)
  };
}

async function readPdfMetadata(file) {
  const bytes = await bytesFromFile(file);
  const flags = metadataTextProbe(bytes);
  let pageCount = 0;
  try {
    pageCount = await getPdfPageCount(file);
  } catch (_error) {
    pageCount = 0;
  }

  let meta = {};
  let editable = true;
  try {
    const pdf = await PDFDocument.load(bytes);
    meta = {
      title: pdf.getTitle?.() || "",
      author: pdf.getAuthor?.() || "",
      subject: pdf.getSubject?.() || "",
      keywords: Array.isArray(pdf.getKeywords?.()) ? pdf.getKeywords().join(", ") : (pdf.getKeywords?.() || ""),
      creator: pdf.getCreator?.() || "",
      producer: pdf.getProducer?.() || "",
      creationDate: pdf.getCreationDate?.() || null,
      modificationDate: pdf.getModificationDate?.() || null
    };
  } catch (_error) {
    editable = false;
  }

  return { bytes, flags, meta, pageCount, editable };
}

function renderMetadataInfo(info) {
  const rows = [
    ["文件名", state.metadata.file?.name || "未知"],
    ["文件大小", state.metadata.file ? formatSize(state.metadata.file.size) : "未知"],
    ["页数", info.pageCount || "未知"],
    ["标题 Title", info.meta.title || "空"],
    ["作者 Author", info.meta.author || "空"],
    ["主题 Subject", info.meta.subject || "空"],
    ["关键词 Keywords", info.meta.keywords || "空"],
    ["创建者 Creator", info.meta.creator || "空"],
    ["生产者 Producer", info.meta.producer || "空"],
    ["创建时间 CreationDate", formatPdfDate(info.meta.creationDate)],
    ["修改时间 ModDate", formatPdfDate(info.meta.modificationDate)],
    ["可能包含 XMP Metadata", info.flags.xmp ? "可能存在" : "未发现"],
    ["可能包含数字签名", info.flags.signature ? "可能存在" : "未发现"],
    ["可能包含注释", info.flags.annotations ? "可能存在" : "未发现"],
    ["可能包含表单", info.flags.forms ? "可能存在" : "未发现"],
    ["可能包含附件", info.flags.attachments ? "可能存在" : "未发现"],
    ["可能包含 JavaScript", info.flags.javascript ? "可能存在" : "未发现"]
  ];
  $("#metadataInfo").classList.remove("empty-preview");
  $("#metadataInfo").innerHTML = renderStatusRows(rows);
  if (info.flags.signature) showAlert("此 PDF 可能包含数字签名，修改元数据可能导致签名失效。", "warn");
}

function fillMetadataForm(info) {
  $("#metadataTitle").value = info.meta.title || "";
  $("#metadataAuthor").value = info.meta.author || "";
  $("#metadataSubject").value = info.meta.subject || "";
  $("#metadataKeywords").value = info.meta.keywords || "";
  $("#metadataCreator").value = info.meta.creator || "";
  $("#metadataProducer").value = info.meta.producer || "";
}

function randomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function randomMetadata(strategy) {
  const id = randomId();
  const presets = {
    minimal: { title: `Document-${id}`, author: `User-${id}`, subject: "", keywords: ["document", "pdf"] },
    general: { title: `Document-${id}`, author: `User-${id}`, subject: "General Document", keywords: ["document", "pdf"] },
    study: { title: `Study-Notes-${id}`, author: `Student-${id}`, subject: "Study Material", keywords: ["study", "notes", "pdf"] },
    work: { title: `Work-Document-${id}`, author: `User-${id}`, subject: "Work Document", keywords: ["work", "document", "pdf"] }
  };
  return {
    ...(presets[strategy] || presets.general),
    creator: "PDF Toolkit Lite",
    producer: "PDF Toolkit Lite"
  };
}

function getCustomMetadata() {
  return {
    title: $("#metadataTitle").value.trim(),
    author: $("#metadataAuthor").value.trim(),
    subject: $("#metadataSubject").value.trim(),
    keywords: $("#metadataKeywords").value.split(",").map((item) => item.trim()).filter(Boolean),
    creator: $("#metadataCreator").value.trim() || "PDF Toolkit Lite",
    producer: $("#metadataProducer").value.trim() || "PDF Toolkit Lite"
  };
}

async function writePdfMetadata(file, values, mode) {
  let pdf;
  try {
    pdf = await PDFDocument.load(await bytesFromFile(file));
  } catch (_error) {
    throw new Error("此 PDF 可以预览，但无法被当前元数据清理引擎修改。可以先尝试生成普通副本，或使用图片化重建。");
  }
  const now = new Date();
  pdf.setTitle(values.title ?? "");
  pdf.setAuthor(values.author ?? "");
  pdf.setSubject(values.subject ?? "");
  pdf.setKeywords(values.keywords || []);
  pdf.setCreator(values.creator ?? "PDF Toolkit Lite");
  pdf.setProducer(values.producer ?? "PDF Toolkit Lite");
  pdf.setCreationDate(values.creationDate || now);
  pdf.setModificationDate(values.modificationDate || now);
  let bytes = await pdf.save();
  let deep = false;
  if ($("#metadataDeepRewrite").checked) {
    try {
      bytes = await window.PdfQpdf.makeNormalCopy(bytes, { removeRestrictions: false, preserveMetadata: true });
      deep = true;
    } catch (error) {
      showAlert(`QPDF 深度清理模块未启用或重写失败，当前仅使用基础元数据清理。${friendlyError(error)}`, "warn");
    }
  }
  return { bytes, mode: deep ? `${mode} / 深度清理` : mode, processedFields: 8 };
}

function showMetadataResult(bytes, filename, report) {
  const info = makeDownload($("#metadataDownload"), bytes, filename);
  const residual = metadataTextProbe(bytes);
  const residualRows = [
    ["XMP", residual.xmp ? "可能残留" : "未发现"],
    ["数字签名", residual.signature ? "可能残留" : "未发现"],
    ["注释", residual.annotations ? "可能残留" : "未发现"],
    ["表单", residual.forms ? "可能残留" : "未发现"],
    ["附件", residual.attachments ? "可能残留" : "未发现"],
    ["JavaScript", residual.javascript ? "可能残留" : "未发现"]
  ];
  const result = $("#metadataResult");
  result.innerHTML = `
    <strong>处理完成</strong>
    <p>${escapeHTML(info.filename)} · ${formatSize(info.size)} · 处理模式：${escapeHTML(report.mode)} · 已处理字段 ${report.processedFields} 个</p>
    <p>可能残留检测</p>
    ${renderStatusRows(residualRows)}
    <div class="button-row">
      <a class="download-btn" href="${info.url}" download="${escapeHTML(info.filename)}">下载文件</a>
      <button class="ghost-btn" type="button" data-result-clear="metadata">再处理一个文件 / 清空</button>
    </div>
  `;
  result.classList.remove("hidden");
  result.querySelector("[data-result-clear]").addEventListener("click", () => clearTool("metadata"));
  result.scrollIntoView({ behavior: "smooth", block: "center" });
  $("#metadataDownload").classList.add("pulse");
  window.setTimeout(() => $("#metadataDownload").classList.remove("pulse"), 2000);
}

async function runMetadataMode(btn, mode) {
  try {
    if (!state.metadata.file) throw new Error("请先上传一个 PDF。");
    setBusy(btn, true, "正在处理...");
    const values = mode === "清空"
      ? {
          title: "",
          author: "",
          subject: "",
          keywords: [],
          creator: "PDF Toolkit Lite",
          producer: "PDF Toolkit Lite"
        }
      : mode === "随机"
        ? randomMetadata($("#metadataRandomStrategy").value)
        : getCustomMetadata();
    const report = await writePdfMetadata(state.metadata.file, values, mode);
    showMetadataResult(report.bytes, buildOutputName(state.metadata.file, mode === "随机" ? "metadata-randomized" : "metadata-cleaned"), report);
    showAlert("PDF 元数据已处理。可重新上传导出的 PDF 检查字段变化。");
  } catch (error) {
    showAlert(friendlyError(error), "error");
  } finally {
    setBusy(btn, false);
  }
}

function initMetadata() {
  $("#metadataFile").addEventListener("change", async (event) => {
    handleNewInput("metadata");
    const file = event.target.files[0];
    state.metadata.file = file || null;
    state.metadata.info = null;
    state.metadata.pageCount = 0;
    if (!file) return;
    warnLargeFiles([file]);
    renderFileMeta("#metadataMeta", file);
    $("#metadataInfo").classList.add("empty-preview");
    $("#metadataInfo").textContent = "正在读取元数据...";
    try {
      const info = await readPdfMetadata(file);
      state.metadata.info = info;
      state.metadata.pageCount = info.pageCount;
      renderFileMeta("#metadataMeta", file, info.pageCount ? `${info.pageCount} 页` : "页数未知");
      renderMetadataInfo(info);
      fillMetadataForm(info);
      if (!window.PdfQpdf?.isAvailable()) {
        $("#metadataDeepRewrite").checked = false;
      }
    } catch (error) {
      $("#metadataInfo").textContent = friendlyError(error);
      showAlert(friendlyError(error), "error");
    }
  });
  $("#metadataClearBtn").addEventListener("click", (event) => runMetadataMode(event.currentTarget, "清空"));
  $("#metadataRandomBtn").addEventListener("click", (event) => runMetadataMode(event.currentTarget, "随机"));
  $("#metadataCustomBtn").addEventListener("click", (event) => runMetadataMode(event.currentTarget, "自定义"));
  $("#metadataDeepRewrite").addEventListener("change", (event) => {
    if (event.target.checked && !window.PdfQpdf?.isAvailable()) {
      showAlert("QPDF 深度清理模块未启用，当前仅使用基础元数据清理。", "warn");
    }
  });
}

async function initImagePdf() {
  const list = $("#imagePdfList");
  syncSortableFiles(list, () => state.imagepdf.files, () => {
    renderImagePdfFileList();
    renderImagePdfPreviews();
  });
  $("#imagePdfFiles").addEventListener("change", async (event) => {
    handleNewInput("imagepdf");
    state.imagepdf.files = Array.from(event.target.files);
    warnLargeFiles(state.imagepdf.files);
    await loadImageDimensions(state.imagepdf.files);
    renderImagePdfFileList();
    renderImagePdfPreviews();
  });
  $("#imagePdfBtn").addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    try {
      if (!state.imagepdf.files.length) throw new Error("请先上传 JPG 或 PNG 图片。");
      setBusy(btn, true, "正在生成...");
      const pdf = await PDFDocument.create();
      const pageSize = $("#imagePdfPageSize").value;
      const margin = Number($("#imagePdfMargin").value);
      const fit = $("#imagePdfFit").value;
      for (const file of state.imagepdf.files) {
        const img = await embedImage(pdf, file);
        const page = pageSize === "a4p" ? pdf.addPage([595.28, 841.89]) : pageSize === "a4l" ? pdf.addPage([841.89, 595.28]) : pdf.addPage([img.width, img.height]);
        page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: $("#imagePdfBg").value === "black" ? rgb(0, 0, 0) : rgb(1, 1, 1) });
        const maxW = page.getWidth() - margin * 2;
        const maxH = page.getHeight() - margin * 2;
        const scale = fit === "cover" ? Math.max(maxW / img.width, maxH / img.height) : Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (page.getWidth() - w) / 2, y: (page.getHeight() - h) / 2, width: w, height: h });
      }
      const bytes = await pdf.save();
      showResult("imagepdf", $("#imagePdfDownload"), bytes, buildOutputName(state.imagepdf.files[0], "images"), `${state.imagepdf.files.length} 页`);
      showAlert(`图片 PDF 生成完成，共 ${state.imagepdf.files.length} 页。`);
    } catch (error) {
      showAlert(friendlyError(error), "error");
    } finally {
      setBusy(btn, false);
    }
  });
}

async function loadImageDimensions(files) {
  await Promise.all(files.map((file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.imagepdf.dimensions.set(file.name + file.size, { width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  })));
}

function renderImagePdfFileList() {
  const list = $("#imagePdfList");
  list.innerHTML = "";
  state.imagepdf.files.forEach((file, index) => {
    const dims = state.imagepdf.dimensions.get(file.name + file.size);
    const li = document.createElement("li");
    li.dataset.index = String(index);
    const text = document.createElement("span");
    text.textContent = `${index + 1}. ${file.name}`;
    const small = document.createElement("small");
    small.textContent = `${dims ? `${dims.width} x ${dims.height} · ` : ""}${formatSize(file.size)}`;
    text.append(document.createElement("br"), small);
    const button = document.createElement("button");
    button.className = "ghost-btn";
    button.type = "button";
    button.dataset.removeImage = String(index);
    button.textContent = "删除";
    li.append(text, button);
    list.appendChild(li);
  });
  list.querySelectorAll("[data-remove-image]").forEach((button) => button.addEventListener("click", () => {
    state.imagepdf.files.splice(Number(button.dataset.removeImage), 1);
    renderImagePdfFileList();
    renderImagePdfPreviews();
  }));
}

function renderImagePdfPreviews() {
  const preview = $("#imagePdfPreview");
  preview.querySelectorAll("img").forEach((img) => {
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
  });
  preview.innerHTML = "";
  for (const file of state.imagepdf.files) {
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);
    img.alt = file.name;
    img.src = url;
    img.dataset.url = url;
    preview.appendChild(img);
  }
}

function initTheme() {
  const saved = localStorage.getItem("pdf-toolkit-theme") || "light";
  document.documentElement.dataset.theme = saved;
  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("pdf-toolkit-theme", next);
    saveSettingsState();
  });
}

function initLayoutModes() {
  const wideButton = $("#wideModeToggle");
  const compactButton = $("#compactModeToggle");
  const apply = () => {
    const wide = localStorage.getItem("pdf-toolkit-wide") === "true";
    const compact = localStorage.getItem("pdf-toolkit-compact") === "true";
    document.body.classList.toggle("wide-mode", wide);
    document.body.classList.toggle("compact-mode", compact);
    if (wideButton) wideButton.classList.toggle("active", wide);
    if (compactButton) compactButton.classList.toggle("active", compact);
  };
  wideButton?.addEventListener("click", () => {
    localStorage.setItem("pdf-toolkit-wide", String(localStorage.getItem("pdf-toolkit-wide") !== "true"));
    apply();
  });
  compactButton?.addEventListener("click", () => {
    localStorage.setItem("pdf-toolkit-compact", String(localStorage.getItem("pdf-toolkit-compact") !== "true"));
    apply();
  });
  apply();
}

function initClearButtons() {
  $("#clearToolBtn").addEventListener("click", () => clearTool(state.active));
  $$("[data-clear]").forEach((button) => button.addEventListener("click", () => clearTool(button.dataset.clear)));
}

function initDropzones() {
  $$(".dropzone").forEach((zone) => {
    const input = zone.querySelector("input[type='file']");
    if (!input) return;
    ["dragenter", "dragover"].forEach((name) => zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.add("dragover");
    }));
    ["dragleave", "drop"].forEach((name) => zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.remove("dragover");
    }));
    zone.addEventListener("drop", (event) => {
      const files = Array.from(event.dataTransfer.files).filter((file) => {
        if (input.accept.includes("application/pdf")) return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (input.accept.includes("image/")) return file.type === "image/png" || file.type === "image/jpeg";
        return true;
      });
      if (!files.length) {
        showAlert(t("err_file_type_mismatch"), "warn");
        return;
      }
      const transfer = new DataTransfer();
      (input.multiple ? files : files.slice(0, 1)).forEach((file) => transfer.items.add(file));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function initThumbSizeToggles() {
  $$(".thumb-size-toggle").forEach((group) => {
    const target = $(`#${group.dataset.target}`);
    if (target) target.classList.add("size-small");
    group.querySelectorAll("[data-size]").forEach((button) => {
      button.addEventListener("click", () => {
        group.querySelectorAll("[data-size]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        if (!target) return;
        target.classList.remove("size-small", "size-medium", "size-large");
        target.classList.add(`size-${button.dataset.size}`);
      });
    });
  });
}

async function init() {
  // Load settings from URL params first
  loadSettingsFromURL();
  // Restore last active tool from settings
  const settings = getSettings();
  if (settings.lastTool && tools.some(t => t[0] === settings.lastTool)) {
    state.active = settings.lastTool;
  }
  setupTools();
  initTheme();
  initLayoutModes();
  initClearButtons();
  initDropzones();
  initThumbSizeToggles();
  initLargePreviews();
  // i18n
  applyI18N();
  const langBtn = document.getElementById("langBtn");
  if (langBtn) langBtn.addEventListener("click", toggleLang);
  await initMerge();
  await initSplit();
  await initManage();
  await initNumber();
  await initTextWatermark();
  await initImageWatermark();
  await initSignature();
  await initAnnotate();
  initPermissions();
  initNormalCopy();
  initProtect();
  initMetadata();
  await initImagePdf();
  showAlert(t("alert_ready"));
  // Save initial settings state
  saveSettingsState();
}

init().catch((error) => showAlert(friendlyError(error) || "初始化失败。", "error"));
