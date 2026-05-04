/* FxxKPDF — zipUtils.js: ZIP file creation and download utilities */
(function () {
  "use strict";

  function getZipFileName() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var d = String(now.getDate()).padStart(2, "0");
    return "FxxKPDF-results-" + y + "-" + m + "-" + d + ".zip";
  }

  async function downloadAsZip(files, baseName) {
    if (!files.length) return;
    if (typeof JSZip === "undefined") {
      throw new Error(window.i18n.getLang() === "zh"
        ? "JSZip \u5e93\u672a\u52a0\u8f7d\uff0c\u65e0\u6cd5\u751f\u6210 ZIP\u3002"
        : "JSZip library not loaded.");
    }
    var zip = new JSZip();
    for (var i = 0; i < files.length; i++) {
      zip.file(files[i].name, files[i].data);
    }
    var content = await zip.generateAsync({ type: "blob" });
    var url = URL.createObjectURL(content);
    var a = document.createElement("a");
    a.href = url;
    a.download = baseName || getZipFileName();
    a.click();
    URL.revokeObjectURL(url);
  }

  function showZipResult(toolId, files, zipFileName) {
    var $ = function (sel) { return document.querySelector(sel); };
    var t = window.i18n.t;
    var currentLang = window.i18n.getLang();
    var resultId = {
      imagewatermark: "imageWatermark",
      textwatermark: "textWatermark",
      imagepdf: "imagePdf"
    }[toolId] || toolId;
    var result = $("#" + resultId + "Result");
    if (!result) return;
    var totalSize = files.reduce(function (sum, f) { return sum + f.data.length; }, 0);
    var formatSize = window.appUI ? window.appUI.formatSize : function (bytes) {
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / 1024 / 1024).toFixed(1) + " MB";
    };
    var escapeHTML = window.appUI ? window.appUI.escapeHTML : function (v) {
      return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    };
    result.innerHTML =
      "<strong>" + t("success_split") + "</strong>" +
      "<p>" + t("output_count") + "\uff1a" + files.length + " \u4e2a\u6587\u4ef6 \u00b7 " + formatSize(totalSize) + "</p>" +
      '<div class="file-list-summary">' + files.map(function (f) { return escapeHTML(f.name); }).join(", ") + "</div>" +
      '<div class="button-row">' +
      '<button class="primary-btn zip-download-btn" type="button" data-zip-tool="' + toolId + '">' + t("zip_download") + "</button>" +
      '<button class="ghost-btn" type="button" data-result-clear="' + toolId + '">' + (currentLang === "zh" ? "\u518d\u5904\u7406\u4e00\u4e2a\u6587\u4ef6 / \u6e05\u7a7a" : "Process another / Clear") + "</button>" +
      "</div>";
    result.classList.remove("hidden");
    result.querySelector("[data-result-clear]").addEventListener("click", function () {
      if (window.clearTool) window.clearTool(toolId);
    });
    var zipBtn = result.querySelector(".zip-download-btn");
    var zipBusy = false;
    zipBtn.addEventListener("click", async function () {
      if (zipBusy) return;
      zipBusy = true;
      zipBtn.disabled = true;
      zipBtn.textContent = t("zip_generating");
      try {
        await downloadAsZip(files, zipFileName || getZipFileName());
        window.appUI?.showAlert(t("zip_ready"));
        window.storage?.addRecentOperation(toolId, zipFileName || getZipFileName(), totalSize, { outputCount: files.length, isZip: true });
      } catch (error) {
        window.appUI?.showAlert(t("zip_download_failed") + "\uff1a" + (error.message || error), "error");
      } finally {
        zipBusy = false;
        zipBtn.disabled = false;
        zipBtn.textContent = t("zip_download");
      }
    });
    result.scrollIntoView({ behavior: "smooth", block: "center" });
    window.storage?.addRecentOperation(toolId, zipFileName || getZipFileName(), totalSize, { outputCount: files.length, isZip: true });
  }

  window.zipUtils = {
    getZipFileName: getZipFileName,
    downloadAsZip: downloadAsZip,
    showZipResult: showZipResult
  };
})();
