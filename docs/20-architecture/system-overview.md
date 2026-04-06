# 系统架构概览

## 技术栈

- Chrome Extension Manifest V3
- TypeScript（strict 模式）
- Vanilla DOM + CSS（MVP 不引入 UI 框架）
- 打包工具：Vite（配合 Vitest 做测试）
- 存储：`chrome.storage.local`

## 架构分层

### 1. Extension 层

Chrome 扩展本体：

- `manifest.json` — 权限、入口声明
- `background/` — service worker，负责消息中转和生命周期
- `popup/` — 扩展弹窗 UI
- `options/` — 完整规则管理页
- `storage/` — chrome.storage 封装

### 2. Content Script 层

注入 AO3 页面，负责：

- 识别页面中的 tag / works
- 执行规则匹配
- 渲染样式变化
- 挂载 hover 按钮和交互菜单

### 3. Core 核心逻辑层

与页面和插件 UI 完全解耦：

- 规则模型与类型定义
- 匹配引擎（exact / contains / wildcard）
- 冲突优先级解析
- 命中结果结构化输出

### 4. UI 层

分两块：

- 页面内悬停按钮 + 快速添加菜单（content script 内，用 Shadow DOM 隔离样式）
- Popup / Options 管理界面（扩展自有页面）

## 架构约束

1. **规则模型 ↔ 交互层分离** — 规则不依赖 hover；以后移动端可以换成 tap / long press，底层规则无需重写。
2. **匹配引擎 ↔ 渲染层分离** — 命中逻辑是纯函数；渲染是独立的一遍 pass。
3. **Content script ↔ 管理 UI 分离** — content script 只读规则、做渲染；popup / options 只写规则。

## 目录结构

```
src/
  background/
    index.ts              # service worker 入口

  content/
    index.ts              # content script 入口
    pageObserver.ts        # MutationObserver，监听 DOM 变化
    ao3Parser.ts           # AO3 页面 tag / work 解析
    renderer.ts            # 命中结果 → DOM 样式渲染
    hoverMenu.ts           # 悬停按钮 + 快速添加菜单
    workEffects.ts         # 作品级效果（warn 边框、hideWork 折叠）

  core/
    types.ts               # Rule, Settings, ParsedTag, ParsedWork, MatchResult
    ruleEngine.ts          # 规则匹配主逻辑
    wildcard.ts            # 通配符匹配实现
    priority.ts            # 冲突优先级解析
    normalize.ts           # tag 文本标准化

  storage/
    ruleStorage.ts         # 规则 CRUD 封装
    settingsStorage.ts     # 设置读写封装

  popup/
    index.html
    index.ts
    popup.css

  options/
    index.html
    index.ts
    options.css

  shared/
    constants.ts           # 常量
    message.ts             # 消息类型定义（background ↔ content ↔ popup）
    utils.ts               # 通用工具函数

  styles/
    content.css            # content script 注入的样式
```

## 数据模型

### Rule（规则）

```typescript
type RuleAction = "highlight" | "warn" | "mute" | "hideWork";
type MatchMode = "exact" | "contains" | "wildcard";
type TagCategory = "relationship" | "character" | "freeform" | "all";

interface Rule {
  id: string;
  label?: string;
  pattern: string;
  action: RuleAction;
  matchMode: MatchMode;
  category: TagCategory;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  note?: string;
  groupId?: string | null;
  source?: "manual" | "quickAdd";
}
```

### Settings（设置）

```typescript
interface Settings {
  extensionEnabled: boolean;
  hoverButtonEnabled: boolean;
  showToast: boolean;
  hideWorkMode: "collapse" | "hide";
  enableOnWorkDetailPage: boolean;
}
```

### 页面解析结果

```typescript
interface ParsedTag {
  id: string;
  text: string;
  normalizedText: string;
  category: "relationship" | "character" | "freeform";
  element: HTMLElement;
  workId: string;
}

interface ParsedWork {
  id: string;
  element: HTMLElement;
  tags: ParsedTag[];
}
```

### 命中结果

```typescript
interface TagMatch {
  tagId: string;
  ruleId: string;
  action: RuleAction;
}

interface WorkMatchSummary {
  workId: string;
  matchedRuleIds: string[];
  hasWarn: boolean;
  hasHideWork: boolean;
}

interface MatchResult {
  tagMatches: TagMatch[];
  workSummaries: WorkMatchSummary[];
}
```

## 数据流

```
AO3 页面加载
  → ao3Parser 解析出 ParsedWork[] + ParsedTag[]
  → ruleEngine 用 Rule[] 匹配，输出 MatchResult
  → renderer 读 MatchResult，修改 DOM 样式
  → 用户 hover tag → hoverMenu 出现
  → 用户选 action → ruleStorage 写入新 Rule
  → 重新匹配 + 重新渲染
```
