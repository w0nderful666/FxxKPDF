# PDF 小工坊 / PDF Toolkit Lite

免费开源、纯前端、本地处理的 PDF 工具箱。项目可部署到 GitHub Pages / Cloudflare Pages，不需要后端、数据库或账号系统。

## 在线体验

- 在线使用：[https://w0nderful666.github.io/FxxKPDF/](https://w0nderful666.github.io/FxxKPDF/)
- GitHub 仓库：[https://github.com/w0nderful666/FxxKPDF](https://github.com/w0nderful666/FxxKPDF)

如果刚刚启用 GitHub Pages，首次访问可能需要等待 1-3 分钟生效。

## 功能列表

- PDF 合并、拆分 / 提取页面
- 页面管理：预览、选择、删除、提取、排序、旋转
- 添加页码、文字水印、图片水印
- 签名 / 盖章、文字 / 形状 / 图片标注
- JPG / PNG 转 PDF
- PDF 权限检测、生成普通副本、PDF 加密码
- PDF 元数据清理 / 文件属性脱敏
- 暗黑模式、全宽模式、紧凑模式、拖拽上传

## QPDF WebAssembly

当前版本已 vendor `qpdf-wasm-esm-embedded@1.1.1`：

```text
libs/qpdf/qpdf.mjs
```

这是内嵌 WASM 的 ESM 单文件，不需要额外 `.wasm` 文件。重新生成 vendor 文件：

```bash
npm install
npm run vendor:qpdf
```

运行时不需要提交 `node_modules`，但需要提交 `libs/qpdf/qpdf.mjs`。

## V1.2 大预览

新增可复用单页大预览组件，每次只渲染当前页，支持翻页、页码跳转、缩放和适应宽度。签名、标注、水印、页码工具已接入大预览层。

## V1.3 PDF 权限检测

使用 PDF.js 检测页数、预览状态和权限状态。QPDF 可用时额外显示 QPDF 检测结果，包括加密状态、是否需要打开密码、owner permission 限制和是否可生成普通副本。

## V1.4 生成普通副本 / 权限修复

优先调用 QPDF：

```text
qpdf --password=<已知打开密码或空字符串> --decrypt input.pdf output.pdf
```

适用于用户自己拥有权利的 owner permission 限制 PDF，以及用户已知打开密码的 PDF。不破解未知密码、不爆破密码、不绕过 DRM 或企业权限系统。

## V1.5 PDF 加密码

依赖 QPDF，支持打开密码、可选权限密码，以及打印、复制、修改、注释、填写表单、页面提取等基础权限设置。项目不会使用 pdf-lib 假装加密。

## V1.6 PDF 元数据清理

新增“PDF 元数据清理”工具，用于查看、清空、随机替换或自定义写入 PDF 内部元数据。

支持查看：

- 标题 Title
- 作者 Author
- 主题 Subject
- 关键词 Keywords
- 创建者 Creator
- 生产者 Producer
- 创建时间 CreationDate
- 修改时间 ModDate
- 是否可能包含 XMP Metadata、数字签名、注释、表单、附件、JavaScript

支持处理：

- 一键清空元数据
- 一键随机替换，包含极简随机、普通文档、学习资料、工作文档策略
- 自定义写入标题、作者、主题、关键词、创建者、生产者
- 可选 QPDF 深度重写 PDF，实验性尝试移除旧对象残留和未引用对象

边界说明：

- 本工具处理 PDF 文件内部元数据，不遮盖页面内容。
- 浏览器无法可靠修改 Windows / macOS 文件系统属性，例如文件创建时间、访问时间、文件路径。
- 不保证 100% 清除所有私有隐藏信息。复杂 XMP、附件、JavaScript、私有对象可能仍需专业审计。
- 如果 PDF 包含数字签名，修改元数据可能导致签名失效。
- 所有处理都在浏览器本地完成，不上传服务器。

## 图片化重建副本

图片化重建使用 PDF.js 渲染页面，再用 pdf-lib 生成扫描版 PDF。它是兜底方案，不是权限修复。重建后文字不可复制，文件可能变大，质量取决于清晰度设置。

## 隐私说明

- 文件只在浏览器本地处理
- 不上传服务器
- 密码不保存
- 刷新页面后文件和密码会清空

## 本地运行

```bash
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080
```

## GitHub Pages / Cloudflare Pages

GitHub Pages：提交项目根目录文件和 `libs/qpdf/qpdf.mjs`，在 `Settings -> Pages` 中选择发布分支和根目录。

Cloudflare Pages：构建命令可留空，输出目录使用项目根目录。如果要重新 vendor QPDF，可使用：

```bash
npm install && npm run vendor:qpdf
```

发布前请确认 `libs/qpdf/qpdf.mjs` 已提交；不需要提交 `node_modules`。如果直接用 `file://` 打开页面，基础 PDF 功能通常可用，但 QPDF 模块需要 HTTP 静态服务或 GitHub Pages。

推荐部署安全头：

```text
Content-Security-Policy:
  default-src 'self';
  object-src 'none';
  base-uri 'self';
  img-src 'self' blob: data:;
  worker-src 'self' blob: https://cdn.jsdelivr.net;
  script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
```

如果实际部署中 PDF.js CDN worker 或 QPDF WASM 被 CSP 阻止，请先以可用性为准调整策略，再逐步收紧。

## 安全说明

- 文件只在浏览器本地处理，不上传服务器。
- 密码不保存，不写入 localStorage、URL 或日志。
- 建议部署方使用 HTTPS。
- 建议锁定依赖版本。
- 后续可把 pdf-lib、PDF.js、SortableJS 从 CDN vendor 到本地，降低供应链风险。
- 页面会转义文件名、PDF 元数据和错误文本，避免恶意文件名或恶意元数据注入脚本。

## 技术栈

- HTML
- CSS
- JavaScript
- pdf-lib 1.17.1
- PDF.js 3.11.174
- SortableJS 1.15.2
- qpdf-wasm-esm-embedded 1.1.1

## 已知限制

- 不破解未知打开密码
- 不爆破密码
- 不绕过 DRM
- 不绕过企业权限系统、在线授权系统或指定阅读器授权
- 数字签名 PDF 修改后可能导致签名失效
- 图片化重建会让文字不可复制
- 元数据清理不修改操作系统文件属性
- 元数据清理不保证 100% 删除所有私有隐藏信息
- 大文件处理速度取决于设备性能

## 手动测试清单

基础功能：

- PDF 合并
- PDF 拆分
- 页面管理排序、删除、旋转、导出
- 添加页码
- 中文文字水印
- 图片水印
- 签名
- 标注
- 图片转 PDF

QPDF / 权限：

- 普通 PDF 生成普通副本
- owner permission 限制 PDF 生成普通副本
- 需要打开密码的 PDF 输入正确密码后生成普通副本
- 密码错误时显示友好提示
- QPDF 不可用时显示降级提示
- PDF 加密码正常生成
- 加密后重新上传到“PDF 权限检测”确认状态

V1.6 元数据：

- 上传普通 PDF，能读取标题、作者等信息
- 一键清空后，重新上传检测，字段已清理
- 一键随机后，重新上传检测，字段已变更
- 自定义信息后，重新上传检测，字段正确
- 带数字签名迹象的 PDF 有提示
- 带注释 / 表单 / 附件 / JavaScript 迹象的 PDF 有提示
- 受保护 PDF 无法处理时提示友好
- QPDF 不可用时基础清理仍可用
- GitHub Pages 部署后可用

发布前收尾：

- 直接 `file://` 打开时，基础功能可用，QPDF 提示需要 HTTP 服务。
- `python -m http.server 8080` 下，QPDF 能加载。
- GitHub Pages 下，QPDF 能加载。
- 生成普通副本可用。
- PDF 加密码可用。
- 图片水印预览大小与导出基本一致，未旋转时一致。
- 图片化重建标准 / 高清 / 打印级正常。
- 下载文件名保留原名。
- 恶意文件名 `<img src=x onerror=alert(1)>.pdf` 不执行脚本。
- 恶意 PDF 元数据 `Title = <script>alert(1)</script>` 不执行脚本。
- 手机端布局正常。
- 暗黑、全宽、紧凑模式正常。

体验：

- 大预览翻页 / 缩放正常
- 签名、标注点击放置正常
- 水印、页码预览正常
- 全宽模式和紧凑模式可记住状态
- 手机端布局正常，大预览不横向溢出

## 免责声明

请仅处理你拥有权利或已获得授权的 PDF 文件。本项目不会提供密码爆破、破解未知密码、绕过 DRM 或绕过企业授权系统等功能。
