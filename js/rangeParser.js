/* FxxKPDF — rangeParser.js: Page range parsing with i18n error messages */
(function () {
  "use strict";

  function parsePageRange(input, total) {
    var text = (input || "").trim();
    if (!text) throw new Error(window.i18n.t("err_range_required"));
    var pages = [];
    var parts = text.split(",");
    for (var pi = 0; pi < parts.length; pi++) {
      var token = parts[pi].trim();
      if (!token) continue;
      if (/^\d+$/.test(token)) {
        pages.push(Number(token));
      } else if (/^\d+\s*-\s*\d+$/.test(token)) {
        var rangeParts = token.split("-").map(function (v) { return Number(v.trim()); });
        var start = rangeParts[0], end = rangeParts[1];
        if (start > end) throw new Error(window.i18n.currentLang === "en"
          ? "Range " + token + ": start cannot be greater than end."
          : "\u9875\u7801\u8303\u56f4 " + token + " \u7684\u8d77\u59cb\u9875\u4e0d\u80fd\u5927\u4e8e\u7ed3\u675f\u9875\u3002");
        for (var i = start; i <= end; i += 1) pages.push(i);
      } else {
        throw new Error(window.i18n.currentLang === "en"
          ? "Cannot parse page range: " + token
          : "\u65e0\u6cd5\u8bc6\u522b\u9875\u7801\u8303\u56f4\uff1a" + token);
      }
    }
    var unique = [];
    var seen = {};
    for (var j = 0; j < pages.length; j++) {
      if (!seen[pages[j]]) { seen[pages[j]] = true; unique.push(pages[j]); }
    }
    var bad = null;
    for (var k = 0; k < unique.length; k++) {
      if (unique[k] < 1 || unique[k] > total) { bad = unique[k]; break; }
    }
    if (bad !== null) {
      throw new Error(window.i18n.currentLang === "en"
        ? "Page " + bad + " is out of range. This PDF has " + total + " pages."
        : "\u9875\u7801 " + bad + " \u8d85\u51fa\u8303\u56f4\u3002\u5f53\u524d PDF \u5171 " + total + " \u9875\u3002");
    }
    return unique.map(function (page) { return page - 1; });
  }

  function parsePageRangeDetailed(input, total) {
    var text = (input || "").trim();
    if (!text) throw new Error(window.i18n.t("err_range_required"));
    var pages = [];
    var parts = text.split(",");
    for (var pi = 0; pi < parts.length; pi++) {
      var token = parts[pi].trim();
      if (!token) continue;
      if (/^\d+$/.test(token)) {
        pages.push(Number(token));
      } else if (/^\d+\s*-\s*\d+$/.test(token)) {
        var rangeParts = token.split("-").map(function (v) { return Number(v.trim()); });
        var start = rangeParts[0], end = rangeParts[1];
        if (start > end) throw new Error("\u9875\u7801\u8303\u56f4 " + token + " \u7684\u8d77\u59cb\u9875\u4e0d\u80fd\u5927\u4e8e\u7ed3\u675f\u9875\u3002");
        for (var i = start; i <= end; i += 1) pages.push(i);
      } else {
        throw new Error("\u65e0\u6cd5\u8bc6\u522b\u9875\u7801\u8303\u56f4\uff1a" + token);
      }
    }
    var unique = [];
    var seen = {};
    for (var j = 0; j < pages.length; j++) {
      if (!seen[pages[j]]) { seen[pages[j]] = true; unique.push(pages[j]); }
    }
    var bad = null;
    for (var k = 0; k < unique.length; k++) {
      if (unique[k] < 1 || unique[k] > total) { bad = unique[k]; break; }
    }
    if (bad !== null) {
      throw new Error("\u9875\u7801 " + bad + " \u8d85\u51fa\u8303\u56f4\u3002\u5f53\u524d PDF \u5171 " + total + " \u9875\u3002");
    }
    return {
      indexes: unique.map(function (page) { return page - 1; }),
      numbers: unique,
      duplicateCount: pages.length - unique.length
    };
  }

  function summarizePages(numbers) {
    var head = numbers.slice(0, 12).join(", ");
    return "\u5c06\u5904\u7406 " + numbers.length + " \u9875\uff1a" + head + (numbers.length > 12 ? "..." : "");
  }

  function parsePageRanges(input, totalPages) {
    var text = (input || "").trim().toLowerCase();
    var lang = window.i18n.getLang();
    if (!text) throw new Error(lang === "zh" ? "\u8bf7\u8f93\u5165\u9875\u9762\u8303\u56f4\u3002" : "Please enter a page range.");
    if (text === "all") {
      var allNums = [];
      for (var a = 1; a <= totalPages; a++) allNums.push(a);
      return { indexes: allNums.map(function (n) { return n - 1; }), numbers: allNums };
    }
    if (text === "odd") {
      var oddNums = [];
      for (var o = 1; o <= totalPages; o += 2) oddNums.push(o);
      return { indexes: oddNums.map(function (n) { return n - 1; }), numbers: oddNums };
    }
    if (text === "even") {
      var evenNums = [];
      for (var e = 2; e <= totalPages; e += 2) evenNums.push(e);
      return { indexes: evenNums.map(function (n) { return n - 1; }), numbers: evenNums };
    }
    var pages = [];
    var parts = text.split(",");
    for (var pi = 0; pi < parts.length; pi++) {
      var token = parts[pi].trim();
      if (!token) continue;
      if (/^\d+$/.test(token)) {
        pages.push(Number(token));
      } else if (/^\d+\s*-\s*\d+$/.test(token)) {
        var rangeParts = token.split("-").map(function (v) { return Number(v.trim()); });
        var start = rangeParts[0], end = rangeParts[1];
        if (start > end) throw new Error(lang === "zh"
          ? "\u9875\u7801\u8303\u56f4 " + token + " \u7684\u8d77\u59cb\u9875\u4e0d\u80fd\u5927\u4e8e\u7ed3\u675f\u9875\u3002"
          : "Range " + token + ": start cannot be greater than end.");
        for (var i = start; i <= end; i += 1) pages.push(i);
      } else {
        throw new Error(lang === "zh"
          ? "\u65e0\u6cd5\u8bc6\u522b\u9875\u9762\u8303\u56f4\uff1a" + token
          : "Cannot parse page range: " + token);
      }
    }
    var unique = [];
    var seen = {};
    for (var j = 0; j < pages.length; j++) {
      if (!seen[pages[j]]) { seen[pages[j]] = true; unique.push(pages[j]); }
    }
    var bad = null;
    for (var k = 0; k < unique.length; k++) {
      if (unique[k] < 1 || unique[k] > totalPages) { bad = unique[k]; break; }
    }
    if (bad !== null) {
      throw new Error(lang === "zh"
        ? "\u9875\u7801 " + bad + " \u8d85\u51fa\u8303\u56f4\u3002\u5f53\u524d PDF \u5171 " + totalPages + " \u9875\u3002"
        : "Page " + bad + " is out of range. This PDF has " + totalPages + " pages.");
    }
    if (unique.length === 0) throw new Error(lang === "zh" ? "\u672a\u9009\u62e9\u4efb\u4f55\u9875\u9762\u3002" : "No pages selected.");
    return { indexes: unique.map(function (page) { return page - 1; }), numbers: unique };
  }

  window.rangeParser = {
    parsePageRange: parsePageRange,
    parsePageRangeDetailed: parsePageRangeDetailed,
    summarizePages: summarizePages,
    parsePageRanges: parsePageRanges
  };
})();
