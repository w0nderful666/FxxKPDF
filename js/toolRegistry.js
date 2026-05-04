/* FxxKPDF — toolRegistry.js: Central registry for all PDF tools */
(function () {
  "use strict";

  var TOOLS = [
    { id: "merge",          i18nTitleKey: "tool_merge",          i18nDescKey: "tool_merge_desc",          icon: "📄", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: true,  supportsZip: false, handlerName: "initMerge" },
    { id: "split",          i18nTitleKey: "tool_split",          i18nDescKey: "tool_split_desc",          icon: "✂️",  status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: false, supportsZip: true,  handlerName: "initSplit" },
    { id: "manage",         i18nTitleKey: "tool_manage",         i18nDescKey: "tool_manage_desc",         icon: "🗂️", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: false, supportsZip: false, handlerName: "initManage" },
    { id: "number",         i18nTitleKey: "tool_number",         i18nDescKey: "tool_number_desc",         icon: "#️⃣", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: false, supportsZip: false, handlerName: "initNumber" },
    { id: "textwatermark",  i18nTitleKey: "tool_textwatermark",  i18nDescKey: "tool_textwatermark_desc",  icon: "💧", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: false, supportsZip: false, handlerName: "initTextWatermark" },
    { id: "imagewatermark", i18nTitleKey: "tool_imagewatermark", i18nDescKey: "tool_imagewatermark_desc", icon: "🖼️", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: false, supportsZip: false, handlerName: "initImageWatermark" },
    { id: "signature",      i18nTitleKey: "tool_signature",      i18nDescKey: "tool_signature_desc",      icon: "✍️", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: false, supportsZip: false, handlerName: "initSignature" },
    { id: "annotate",       i18nTitleKey: "tool_annotate",       i18nDescKey: "tool_annotate_desc",       icon: "📝", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: false, supportsZip: false, handlerName: "initAnnotate" },
    { id: "permissions",    i18nTitleKey: "tool_permissions",    i18nDescKey: "tool_permissions_desc",    icon: "🔒", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "info", supportsMultiple: false, supportsZip: false, handlerName: "initPermissions" },
    { id: "normalcopy",     i18nTitleKey: "tool_normalcopy",     i18nDescKey: "tool_normalcopy_desc",     icon: "📋", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: false, supportsZip: false, handlerName: "initNormalCopy" },
    { id: "protect",        i18nTitleKey: "tool_protect",        i18nDescKey: "tool_protect_desc",        icon: "🔐", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: false, supportsZip: false, handlerName: "initProtect" },
    { id: "metadata",       i18nTitleKey: "tool_metadata",       i18nDescKey: "tool_metadata_desc",       icon: "📊", status: "stable",  acceptedFileTypes: "application/pdf", outputType: "pdf", supportsMultiple: false, supportsZip: false, handlerName: "initMetadata" },
    { id: "imagepdf",       i18nTitleKey: "tool_imagepdf",       i18nDescKey: "tool_imagepdf_desc",       icon: "🖼️", status: "stable",  acceptedFileTypes: "image/png,image/jpeg", outputType: "pdf", supportsMultiple: true, supportsZip: false, handlerName: "initImagePdf" }
  ];

  var ROADMAP = [
    { id: "compress",        i18nTitleKey: "roadmap_compress",        i18nDescKey: "roadmap_compress_desc",        icon: "📦", status: "roadmap" },
    { id: "ocr",             i18nTitleKey: "roadmap_ocr",             i18nDescKey: "roadmap_ocr_desc",             icon: "🔍", status: "roadmap" },
    { id: "batch_watermark", i18nTitleKey: "roadmap_batch_watermark", i18nDescKey: "roadmap_batch_watermark_desc", icon: "🖊️", status: "roadmap" }
  ];

  function getAll() {
    return TOOLS;
  }

  function getStable() {
    return TOOLS.filter(function (t) { return t.status === "stable"; });
  }

  function getRoadmap() {
    return ROADMAP;
  }

  function getById(id) {
    return TOOLS.find(function (t) { return t.id === id; }) || null;
  }

  function getLegacyArray() {
    return TOOLS.map(function (t) { return [t.id, t.i18nTitleKey, t.i18nDescKey]; });
  }

  window.toolRegistry = {
    getAll: getAll,
    getStable: getStable,
    getRoadmap: getRoadmap,
    getById: getById,
    getLegacyArray: getLegacyArray,
    ROADMAP: ROADMAP
  };
})();
