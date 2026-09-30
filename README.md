# 山海食谱铺

静态网页游戏。需要 Node.js 20 或以上版本，无需安装第三方依赖。

## 本地启动

Windows 双击 `启动游戏.cmd`，自动启动服务并打开浏览器。保持窗口打开，按 Ctrl+C 停止。

也可以在项目目录运行：

```sh
npm start
```

默认地址：[http://127.0.0.1:4173/](http://127.0.0.1:4173/)。`npm run dev` 使用同一启动方式。`PORT` 环境变量可覆盖端口，`npm start -- --lan` 可用于同一局域网内试玩。

浏览器存档按访问地址区分；继续使用上面的地址可保留原有记录。

## 静态部署

```sh
npm run build
```

将生成的 `dist/` 目录完整上传到静态托管服务；入口为 `index.html`，无需数据库或应用服务器。托管平台配置：构建命令 `npm run build`，发布目录 `dist`。构建不会自动发布。

推送到 `main` 分支后，`.github/workflows/pages.yml` 会自动构建并发布到 GitHub Pages：<https://kevl0317.github.io/shanhai-restaurant/>。首次使用需在仓库 Settings → Pages 中将 Source 设为 “GitHub Actions”。

`npm run preview` 可在本机检查构建结果。构建会重新生成 `dist/`，请勿在其中手工修改文件。

## 目录

- `index.html`、`src/`：游戏页面与代码。
- `assets/`：游戏实际使用的图片及素材署名。
- `scripts/`：启动服务、静态构建及发布文件清单。
- `启动游戏.cmd`：Windows 启动入口。

发布清单由 `scripts/site.mjs` 定义。本地资料、设计计划、开发检查、临时产物均不纳入版本管理或网站构建。
