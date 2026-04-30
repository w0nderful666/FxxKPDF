# PDF 小工坊 / PDF Toolkit Lite

免费开源、纯前端、本地处理的 PDF 工具箱。项目没有后端、数据库、账号系统或云上传接口，适合部署到 GitHub Pages / Cloudflare Pages。

## 在线体验

- 在线使用：[https://w0nderful666.github.io/FxxKPDF/](https://w0nderful666.github.io/FxxKPDF/)
- GitHub 仓库：[https://github.com/w0nderful666/FxxKPDF](https://github.com/w0nderful666/FxxKPDF)

如果刚刚启用 GitHub Pages，首次访问可能需要等待 1-3 分钟。

## 文件会上传吗？

不会。PDF、图片和密码只在当前浏览器标签页内处理。

- 本项目没有后端、没有数据库、没有上传接口。
- GitHub Pages / Cloudflare Pages 只负责提供静态网页文件。
- 关闭页面或刷新后，已载入的文件会从当前页面状态中清空。
- 其他用户无法从本站服务器读取你的文件，因为文件没有被上传到服务器。
- 你也可以 Fork 本项目并部署到自己的 GitHub Pages，处理敏感文件更安心。

仍需注意：

- 不要使用不可信的镜像站。
- 不要在装有可疑浏览器扩展的环境中处理敏感文件。
- 极敏感文件建议 fork 后自部署，或下载源码后在可信环境中离线使用。
- 浏览器崩溃、恶意扩展、本机木马、系统剪贴板监听等不属于本站能完全控制的范围。

## 功能列表

- PDF 合并、拆分 / 提取页面
- 页面管理：预览、选择、删除、提取、排序、旋转
- 添加页码、文字水印、图片水印
- 签名 / 盖章、文字 / 形状 / 图片标注
- JPG / PNG 转 PDF
- PDF 权限检测、生成普通副本、PDF 加密码
- PDF 元数据清理 / 文件属性脱敏
- 图片化重建副本，支持标准、高清、打印级
- 暗黑模式、全宽模式、紧凑模式、拖拽上传

## 本地依赖

第三方依赖已 vendor 到 `libs/`，页面不再从 CDN 加载核心库：

```text
libs/
  pdf-lib/pdf-lib.min.js                 pdf-lib 1.17.1
  pdfjs/pdf.min.js                       PDF.js 3.11.174
  pdfjs/pdf.worker.min.js                PDF.js worker 3.11.174
  sortable/Sortable.min.js               SortableJS 1.15.2
  qpdf/qpdf.mjs                          qpdf-wasm-esm-embedded 1.1.1
```

重新生成本地依赖：

```bash
npm install
npm run vendor
```

也可以单独执行：

```bash
npm run vendor:libs
npm run vendor:qpdf
```

运行和部署时不需要提交 `node_modules`，但必须提交 `libs/` 下的静态文件。

## QPDF WebAssembly

QPDF 高级模块用于：

- 生成普通副本 / 权限修复
- 用户提供正确打开密码后的合法处理
- PDF 加密码 / 权限设置
- 元数据清理中的实验性深度重写

QPDF 使用稳定 URL 加载：

```js
new URL("./libs/qpdf/qpdf.mjs", document.baseURI).href
```

基础 PDF 功能不依赖 QPDF。即使 QPDF 加载失败，合并、拆分、水印、签名、标注、图片转 PDF 等普通功能仍可使用。

如果直接用 `file://` 打开页面，QPDF 可能无法加载。建议使用本地静态服务：

```bash
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080
```

GitHub Pages / Cloudflare Pages 通过 HTTP/HTTPS 访问，可正常加载 QPDF。

## 隐私和安全设计

- 文件只存在于当前浏览器页面的内存 / Blob URL 中。
- 密码不写入 localStorage、sessionStorage、URL 或 console。
- 文件名、PDF 元数据、错误文本、用户输入都会转义后展示。
- 下载文件名会清理非法字符。
- 项目已加入兼容 WebAssembly 的 CSP meta。
- CSP 是第二层防护，不能替代代码层面的转义。

当前 `index.html` 使用的 CSP meta：

```text
default-src 'self';
base-uri 'self';
object-src 'none';
img-src 'self' blob: data:;
worker-src 'self' blob:;
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
connect-src 'self';
```

如果部署到 Cloudflare Pages，可以在响应头中配置更完整的安全策略。GitHub Pages 的 `github.io` 域名默认支持 HTTPS。敏感文件建议使用自己可信的部署地址。

## 如何验证文件没有上传？

1. 打开浏览器开发者工具。
2. 进入 Network 面板。
3. 勾选 Preserve log。
4. 上传 PDF 并执行处理。
5. 正常情况下只能看到静态资源请求，例如 HTML、JS、CSS、PDF worker、QPDF mjs。
6. 不应出现包含 PDF 文件内容的 POST / PUT / upload 请求。
7. 下载结果通常是 `blob:` 本地对象 URL。

## PDF 权限和密码边界

项目不会：

- 破解未知打开密码
- 爆破密码
- 绕过 DRM
- 绕过企业权限系统、在线授权系统或指定阅读器限制

权限相关能力只用于你拥有权利或已获得授权的 PDF。处理前页面会要求勾选确认。

## PDF 元数据清理边界

“PDF 元数据清理”处理的是 PDF 内部元数据，例如标题、作者、关键词、创建工具、创建时间等。

它不能修改 Windows / macOS 文件系统中的创建时间、访问时间、文件路径等操作系统属性。复杂 XMP、附件、JavaScript、私有对象可能需要专业审计；本工具不承诺 100% 清除所有隐藏信息。如果 PDF 包含数字签名，修改元数据可能导致签名失效。

## GitHub Pages 部署

1. 确认 `libs/qpdf/qpdf.mjs`、`libs/pdf-lib/pdf-lib.min.js`、`libs/pdfjs/pdf.min.js`、`libs/pdfjs/pdf.worker.min.js`、`libs/sortable/Sortable.min.js` 已提交。
2. 推送到 GitHub。
3. 进入仓库 `Settings -> Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，Folder 选择 `/root`。
6. 保存后等待 1-3 分钟。

Cloudflare Pages 可直接以项目根目录作为输出目录；构建命令可留空。如果你希望每次构建重新 vendor 依赖，可使用：

```bash
npm install && npm run vendor
```

## 发布前安全清单

- [ ] 所有依赖已本地 vendor，或明确锁定版本。
- [ ] `libs/qpdf/qpdf.mjs` 已提交。
- [ ] `libs/pdf-lib/`、`libs/pdfjs/`、`libs/sortable/` 已提交。
- [ ] GitHub Pages 使用 HTTPS。
- [ ] 文件名、元数据、用户输入不直接插入未转义 HTML。
- [ ] 恶意文件名测试通过：`<img src=x onerror=alert(1)>.pdf`
- [ ] 恶意 PDF 元数据测试通过：`Title = <script>alert(1)</script>`
- [ ] 恶意 Author 测试通过：`"><img src=x onerror=alert(1)>`
- [ ] 密码不进入 localStorage / console / URL。
- [ ] QPDF 加载失败时不会影响基础功能。
- [ ] Network 面板确认没有文件上传请求。
- [ ] README 已说明隐私边界。

## 手动测试清单

- 直接 `file://` 打开时，基础功能可用，QPDF 提示需要 HTTP 服务。
- `python -m http.server 8080` 下，QPDF 能加载。
- GitHub Pages 下，QPDF 能加载。
- PDF 合并、拆分、页面管理、页码、水印、签名、标注、图片转 PDF 正常。
- 生成普通副本可用。
- PDF 加密码可用。
- 图片水印预览大小与导出基本一致，未旋转时一致。
- 图片化重建标准 / 高清 / 打印级正常。
- 下载文件名保留原名。
- 恶意文件名不执行脚本。
- 恶意 PDF 元数据不执行脚本。
- 手机端布局正常。
- 暗黑、全宽、紧凑模式正常。

## 免责声明

请仅处理你拥有权利或已获得授权的 PDF 文件。本项目不会提供密码爆破、破解未知密码、绕过 DRM 或绕过企业授权系统等功能。
