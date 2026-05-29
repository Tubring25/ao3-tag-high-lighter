# 后续实现总览

## 当前状态

以下模块已完成并通过测试（97/97 tests pass）：

| 模块 | 文件 | 状态 |
|---|---|---|
| 核心类型 | `src/core/types.ts` | ✅ 完成 |
| Tag 标准化 | `src/core/normalize.ts` | ✅ 完成 |
| 通配符匹配 | `src/core/wildcard.ts` | ✅ 完成 |
| 优先级解析 | `src/core/priority.ts` | ✅ 完成 |
| 规则引擎 | `src/core/ruleEngine.ts` | ✅ 完成 |
| AO3 页面解析 | `src/content/ao3Parser.ts` | ✅ 完成 |
| 页面渲染 | `src/content/renderer.ts` / `src/content/workEffects.ts` | ✅ 完成 |
| 本地存储 | `src/storage/ruleStorage.ts` / `src/storage/settingsStorage.ts` | ✅ 完成 |
| Content 最小闭环 | `src/content/contentApp.ts` / `src/content/index.ts` | ✅ 完成 |
| Background 消息中转 | `src/background/backgroundApp.ts` / `src/background/index.ts` | ✅ 完成 |
| Hover quick-add | `src/content/hoverMenu.ts` | ✅ 完成 |
| Toast 反馈 | `src/content/toast.ts` | ✅ 完成 |
| Popup | `src/popup/popupApp.ts` / `src/popup/index.ts` | ✅ 完成 |
| Options 规则管理 | `src/options/optionsApp.ts` / `src/options/index.ts` | ✅ 完成 |
| content 样式 | `src/styles/content.css` | ✅ 完成 |

以下文件存在骨架（stub），需要实现：

| 文件 | 当前状态 |
|---|---|
| `src/content/pageObserver.ts` | stub |

## 推荐实现顺序

```
阶段 1：完成最小闭环（打开 AO3 就能看到效果）
  ├── 步骤 1：storage 模块（E1–E3） → 已完成
  ├── 步骤 2：renderer + workEffects（D1–D5） → 已完成
  ├── 步骤 3：CSS 样式 → 已完成
  ├── 步骤 4：content script 入口串联 → 已完成
  ├── 步骤 5：background service worker → 已完成
  └── 步骤 6：manifest / build 配置修正 → 10-manifest-build.md

阶段 2：页面交互
  ├── 步骤 7：hover 按钮 + 快速添加菜单（F1–F4） → 已完成
  └── 步骤 8：Toast 反馈（I1） → 已完成

阶段 3：管理界面
  ├── 步骤 9：popup（G1–G3） → 已完成
  └── 步骤 10：options 页（H1–H6） → 已完成

阶段 4：稳定性
  └── 步骤 11：Observer / 防抖 / 错误兜底（I2–I6） → 08-stability.md
```

## 各文档索引

| 编号 | 文件 | 覆盖内容 |
|---|---|---|
| 00 | 本文件 | 总览与实现顺序 |
| 01 | `01-renderer.md` | renderer.ts + workEffects.ts（D1–D5） |
| 02 | `02-storage.md` | ruleStorage.ts + settingsStorage.ts（E1–E3） |
| 03 | `03-content-entry.md` | content/index.ts 串联全流程 |
| 04 | `04-hover-menu.md` | hoverMenu.ts（F1–F4） |
| 05 | `05-popup.md` | popup UI（G1–G3） |
| 06 | `06-options.md` | options 规则管理页（H1–H6） |
| 07 | `07-background.md` | background service worker 消息中转 |
| 08 | `08-stability.md` | Toast / Observer / 防抖 / 错误兜底（I1–I6） |
| 09 | `09-css-reference.md` | content.css 完整样式 |
| 10 | `10-manifest-build.md` | manifest.json + vite.config.ts 修正 |

## 阶段验收标志

- **阶段 1 完成标志：** 在 `chrome://extensions` 加载后，打开 AO3 列表页，写死几条规则就能看到 highlight / mute / warn / hideWork 效果。
- **阶段 2 完成标志：** 悬停 tag 出现按钮，点击可创建规则，页面即时更新。当前已完成。
- **阶段 3 完成标志：** popup 显示命中统计 + 全局开关；options 可完整管理规则。当前已完成。
- **阶段 4 完成标志：** 动态加载、页面切换、大量规则场景下不卡顿不报错。
