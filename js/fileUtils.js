/* FxxKPDF — fileUtils.js: Common file and UI utility functions */
(function () {
  "use strict";

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeFileName(name) {
    return String(name || "document")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/[\u0000-\u001f]/g, "")
      .trim()
      .slice(0, 80) || "document";
  }

  function buildOutputName(fileOrName, suffix) {
    var raw = typeof fileOrName === "string" ? fileOrName : (fileOrName && fileOrName.name) || "document.pdf";
    var clean = sanitizeFileName(raw.replace(/\.pdf$/i, ""));
    return clean + "-" + suffix + ".pdf";
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function showAlert(message, type) {
    type = type || "success";
    var el = document.createElement("div");
    el.className = "alert " + type;
    el.textContent = message;
    var alerts = document.querySelector("#alerts");
    if (alerts) alerts.appendChild(el);
    window.setTimeout(function () { el.remove(); }, 6200);
  }

  function friendlyError(error) {
    var message = (error && error.message) || String(error);
    if (/qpdf|wasm|WebAssembly|\u6a21\u5757\u52a0\u8f7d|\u6682\u4e0d\u652f\u6301|module|\u672a\u542f\u7528|\u6253\u5f00\u5bc6\u7801\u4e0d\u6b63\u786e|\u9700\u8981\u6b63\u786e\u6253\u5f00\u5bc6\u7801|DRM|\u4f01\u4e1a\u6743\u9650|\u5728\u7ebf\u6388\u6743|\u6307\u5b9a\u9605\u8bfb\u5668|\u56fe\u7247\u5316\u91cd\u5efa/i.test(message)) {
      return message;
    }
    if (/encrypted|password|\u6743\u9650|\u52a0\u5bc6|protect|security/i.test(message)) {
      return "\u6b64 PDF \u53ef\u4ee5\u9884\u89c8\uff0c\u4f46\u65e0\u6cd5\u88ab\u5f53\u524d\u7f16\u8f91\u5f15\u64ce\u4fee\u6539\u3002\u5b83\u53ef\u80fd\u8bbe\u7f6e\u4e86\u6743\u9650\u4fdd\u62a4\u3001\u7f16\u8f91\u9650\u5236\u3001\u6570\u5b57\u7b7e\u540d\u3001\u8868\u5355\u4fdd\u62a4\u6216\u7279\u6b8a PDF \u7ed3\u6784\u3002\u5f53\u524d\u5de5\u5177\u4e0d\u4f1a\u7834\u89e3\u6216\u7ed5\u8fc7\u6587\u4ef6\u4fdd\u62a4\u3002\u5982\u679c\u8fd9\u662f\u4f60\u6709\u6743\u5904\u7406\u7684\u6587\u4ef6\uff0c\u53ef\u4ee5\u5c1d\u8bd5\u4ece\u539f\u8f6f\u4ef6\u53e6\u5b58\u4e3a\u666e\u901a PDF \u540e\u518d\u5904\u7406\u3002\u80fd\u6253\u5f00\u67e5\u770b\u4e0d\u4ee3\u8868\u4e00\u5b9a\u80fd\u7f16\u8f91\u3002";
    }
    return message;
  }

  function setBusy(button, busy, text) {
    if (!button) return;
    if (busy) {
      button.dataset.oldText = button.textContent;
      button.textContent = text || "\u5904\u7406\u4e2d...";
      button.disabled = true;
    } else {
      button.textContent = button.dataset.oldText || button.textContent;
      button.disabled = false;
    }
  }

  function warnLargeFiles(files) {
    var total = files.reduce(function (sum, file) { return sum + file.size; }, 0);
    if (files.some(function (file) { return file.size > 100 * 1024 * 1024; })) {
      showAlert("\u5355\u4e2a\u6587\u4ef6\u8d85\u8fc7 100MB\uff0c\u5904\u7406\u901f\u5ea6\u4f1a\u53d6\u51b3\u4e8e\u4f60\u7684\u8bbe\u5907\u6027\u80fd\u3002", "warn");
    }
    if (total > 200 * 1024 * 1024) showAlert("\u5f53\u524d\u6587\u4ef6\u603b\u5927\u5c0f\u8d85\u8fc7 200MB\uff0c\u6d4f\u89c8\u5668\u53ef\u80fd\u9700\u8981\u66f4\u4e45\u5904\u7406\u3002", "warn");
  }

  async function bytesFromFile(file) {
    return new Uint8Array(await file.arrayBuffer());
  }

  function showConfirm(message, onConfirm) {
    var config = typeof message === "object" ? message : { message: message };
    var backdrop = document.createElement("div");
    backdrop.className = "confirm-backdrop";
    var box = document.createElement("div");
    box.className = "confirm-box";
    box.innerHTML =
      "<h3>" + escapeHTML(config.title || "\u786e\u8ba4\u64cd\u4f5c") + "</h3>" +
      "<p>" + escapeHTML(config.message || "") + "</p>" +
      '<div class="button-row">' +
      '<button class="primary-btn" type="button">' + escapeHTML(config.confirmText || "\u7ee7\u7eed") + "</button>" +
      '<button class="ghost-btn" type="button">' + escapeHTML(config.cancelText || "\u53d6\u6d88") + "</button>" +
      "</div>";
    var close = function () { backdrop.remove(); box.remove(); };
    box.querySelector(".primary-btn").addEventListener("click", function () { close(); onConfirm(); });
    box.querySelector(".ghost-btn").addEventListener("click", close);
    backdrop.addEventListener("click", close);
    document.body.append(backdrop, box);
  }

  window.appUI = {
    escapeHTML: escapeHTML,
    sanitizeFileName: sanitizeFileName,
    buildOutputName: buildOutputName,
    formatSize: formatSize,
    showAlert: showAlert,
    friendlyError: friendlyError,
    setBusy: setBusy,
    warnLargeFiles: warnLargeFiles,
    bytesFromFile: bytesFromFile,
    showConfirm: showConfirm
  };
})();
