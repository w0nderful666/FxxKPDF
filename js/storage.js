/* FxxKPDF — storage.js: Unified localStorage wrapper with error handling */
(function () {
  "use strict";

  var SK = window.siteMeta.storageKeys;

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_e) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_e) {
      // ignore
    }
  }

  function getSettings() {
    try {
      return JSON.parse(safeGet(SK.settings)) || {};
    } catch (_e) {
      return {};
    }
  }

  function saveSettings(patch) {
    var settings = Object.assign({}, getSettings(), patch);
    safeSet(SK.settings, JSON.stringify(settings));
  }

  function addRecentOperation(tool, filename, outputSize, extra) {
    extra = extra || {};
    var settings = getSettings();
    var recent = settings.recent || [];
    var t = window.i18n.t;
    // find tool name from registry if available
    var toolName = tool;
    if (window.toolRegistry) {
      var entry = window.toolRegistry.getById(tool);
      if (entry) toolName = t(entry.i18nTitleKey);
    }
    recent.unshift({
      tool: tool,
      toolName: toolName,
      filename: filename || "document.pdf",
      timestamp: Date.now(),
      outputSize: outputSize || 0,
      inputCount: extra.inputCount || 1,
      outputCount: extra.outputCount || 1,
      isZip: extra.isZip || false,
      pageRange: extra.pageRange || ""
    });
    saveSettings({ recent: recent.slice(0, 10) });
  }

  function exportSettings() {
    var settings = getSettings();
    settings.version = window.siteMeta.version;
    var blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "fxxkpdf-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importSettings(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var settings = JSON.parse(reader.result);
        safeSet(SK.settings, JSON.stringify(settings));
        if (settings.theme) {
          document.documentElement.dataset.theme = settings.theme;
          safeSet(SK.theme, settings.theme);
        }
        if (settings.lang) {
          window.i18n.setLang(settings.lang);
        }
        window.appUI?.showAlert(window.i18n.t("settings_imported"));
      } catch (_e) {
        window.appUI?.showAlert(window.i18n.t("settings_import_fail"), "error");
      }
    };
    reader.readAsText(file);
  }

  window.storage = {
    safeGet: safeGet,
    safeSet: safeSet,
    safeRemove: safeRemove,
    getSettings: getSettings,
    saveSettings: saveSettings,
    addRecentOperation: addRecentOperation,
    exportSettings: exportSettings,
    importSettings: importSettings
  };
})();
