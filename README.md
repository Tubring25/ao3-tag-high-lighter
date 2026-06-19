# AO3 Tag Highlighter

[English](#english) | [简体中文](#简体中文)

## English

AO3 Tag Highlighter is a desktop Chrome extension for Archive of Our Own readers. It lets you create local tag rules that highlight tags, show warning markers, and collapse matching works on AO3 pages.

### Features

- Highlight relationship, character, and freeform tags on AO3.
- Show warning bars for tags you want to notice before reading.
- Collapse works that match your collapse rules on listing pages.
- Show collapse-rule matches on work detail pages without changing the story text.
- Add rules directly from AO3 tags with the hover `+` quick-add menu.
- Manage rules from the extension Options page.
- Search, filter, edit, pause, delete, and bulk-delete rules.
- Use exact, contains, or wildcard matching.
- Customize highlight and warning tag colors.
- Switch UI language between English, Simplified Chinese, or browser default.
- Store all rules and settings locally in your browser.

### Supported browser and site

- Desktop Chrome / Chromium browsers using Manifest V3.
- `https://archiveofourown.org/*`.

### Install for local development

```sh
npm install
npm run build
```

Then load the built extension:

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Choose **Load unpacked**.
4. Select the `dist/` folder.

### Development commands

```sh
npm run dev             # watch build
npm run build           # production build
npm run lint            # TypeScript check
npm run test            # Vitest test suite
npm run verify          # build + lint + test
npm run verify:release  # release-oriented checks
```

### Privacy

AO3 Tag Highlighter is local-only.

Data stored locally:

- Tag rules created by the user
- Extension settings
- Tag style settings
- Language preference

This data is stored in the user's browser with `chrome.storage.local`.

AO3 Tag Highlighter does not collect, transmit, sell, share, or remotely process user data. It does not use analytics, advertising, cloud sync, account login, or remote scraping. The extension only reads visible AO3 page content in the user's browser so it can apply local visual changes such as tag highlighting, warning indicators, and collapsed work placeholders.

### Permissions

- `storage`: saves rules and settings locally in the browser.
- `https://archiveofourown.org/*`: reads visible AO3 tags and applies local visual changes on AO3 pages.

## 简体中文

AO3 Tag Highlighter 是一个桌面端 Chrome 扩展，面向 Archive of Our Own 读者。你可以创建本地标签规则，在 AO3 页面上高亮标签、显示提醒，并折叠命中的作品。

### 功能

- 高亮 AO3 的 relationship、character、freeform 标签。
- 对需要留意的标签显示 warning 提醒条。
- 在列表页折叠命中折叠规则的作品。
- 在作品详情页显示折叠规则命中提示，但不修改正文内容。
- 在 AO3 标签上悬停，通过 `+` 快速添加规则。
- 在扩展 Options 页面集中管理规则。
- 支持搜索、筛选、编辑、暂停、删除和批量删除规则。
- 支持精确匹配、包含匹配和通配符匹配。
- 支持自定义 highlight / warning 标签颜色。
- 支持 English、简体中文或跟随浏览器语言。
- 所有规则和设置都保存在本地浏览器中。

### 支持的浏览器和网站

- 使用 Manifest V3 的桌面版 Chrome / Chromium 浏览器。
- `https://archiveofourown.org/*`。

### 本地开发安装

```sh
npm install
npm run build
```

然后加载构建后的扩展：

1. 打开 `chrome://extensions`。
2. 开启 Developer mode / 开发者模式。
3. 点击 **Load unpacked / 加载已解压的扩展程序**。
4. 选择 `dist/` 文件夹。

### 开发命令

```sh
npm run dev             # 监听并构建
npm run build           # 生产构建
npm run lint            # TypeScript 检查
npm run test            # Vitest 测试
npm run verify          # build + lint + test
npm run verify:release  # 发布前检查
```

### 隐私

AO3 Tag Highlighter 只在本地工作。

本地保存的数据包括：

- 用户创建的标签规则
- 扩展设置
- 标签样式设置
- 语言偏好

这些数据通过 `chrome.storage.local` 保存在用户自己的浏览器中。

AO3 Tag Highlighter 不收集、不传输、不出售、不共享，也不会远程处理用户数据。扩展不使用 analytics、广告、云同步、账号登录或远程抓取。它只读取用户浏览器中当前 AO3 页面可见的内容，用于在本地应用标签高亮、warning 提醒和作品折叠等视觉变化。

### 权限说明

- `storage`：在浏览器本地保存规则和设置。
- `https://archiveofourown.org/*`：读取 AO3 页面可见标签，并在 AO3 页面上应用本地视觉变化。

## License / 许可证

No license has been selected yet. / 暂未选择许可证。
