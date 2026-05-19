# 10 — Manifest 与 Build 配置

对应文件：`public/manifest.json`、`vite.config.ts`、`popup.html`、`options.html`

## 当前配置

Chrome extension 加载的是 `dist/` 目录，因此 manifest 中的路径必须相对 `dist/` 根目录。

当前 popup / options 使用根目录 HTML 作为 Vite 入口：

```typescript
input: {
  popup: new URL("./popup.html", import.meta.url).pathname,
  options: new URL("./options.html", import.meta.url).pathname,
  "background/index": new URL("./src/background/index.ts", import.meta.url).pathname,
  "content/index": new URL("./src/content/index.ts", import.meta.url).pathname
}
```

对应 manifest：

```json
"action": {
  "default_popup": "popup.html"
},
"options_page": "options.html"
```

`content/index.ts` import `src/styles/content.css`，Vite build 会输出为 `dist/assets/content.css`。manifest 需要显式注入：

```json
"content_scripts": [
  {
    "matches": ["https://archiveofourown.org/*"],
    "css": ["assets/content.css"],
    "js": ["content/index.js"]
  }
]
```

## Build 输出验证

运行 `npm run build` 后，`dist/` 应包含：

```text
dist/
  background/index.js
  content/index.js
  assets/content.css
  assets/popup.css
  assets/options.css
  popup.html
  options.html
  manifest.json
```

验证步骤：

1. 运行 `npm run build`
2. 确认 `dist/manifest.json` 中 popup/options/content CSS 路径存在
3. 打开 Chrome `chrome://extensions`
4. 开启开发者模式并加载 `dist/`
5. 打开 AO3 页面，检查 content script 是否注入
6. 点击扩展图标，检查 popup 是否打开
7. 进入扩展 options，检查 options 页面是否打开

## 开发模式

`npm run dev` 使用 `vite build --watch` 监听文件变化。Chrome 不会自动重新加载扩展，修改后仍需在 `chrome://extensions` 手动刷新扩展。
