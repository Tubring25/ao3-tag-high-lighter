# 测试策略

## 工具选择

- 测试框架：**Vitest**（与 Vite 打包器天然配合）
- DOM 环境：**happy-dom**（轻量、速度快，用于 parser 测试）
- Chrome API mock：手写简单 mock 或使用社区方案

## 分层测试

### 单元测试（必须）

| 模块 | 测什么 | 依赖 |
|---|---|---|
| `core/ruleEngine.ts` | 各匹配模式输入输出 | 无 |
| `core/wildcard.ts` | 通配符解析与匹配 | 无 |
| `core/priority.ts` | 冲突优先级解析 | 无 |
| `core/normalize.ts` | tag 文本标准化 | 无 |
| `storage/ruleStorage.ts` | CRUD 操作 | mock chrome.storage |
| `storage/settingsStorage.ts` | 读写操作 | mock chrome.storage |

### 集成测试（建议）

| 模块 | 测什么 | 依赖 |
|---|---|---|
| `content/ao3Parser.ts` | 喂 AO3 HTML 片段 → 断言 ParsedWork[] / ParsedTag[] | happy-dom |
| parser + ruleEngine | 解析 → 匹配 → 验证 MatchResult | happy-dom |

### 手动测试（MVP 阶段够用）

| 对象 | 测什么 |
|---|---|
| Popup | 命中统计、全局开关、跳转 |
| Options | 规则 CRUD、搜索、启停 |
| 页面交互 | hover 按钮、菜单、即时更新、Toast |
| 样式隔离 | 注入样式不影响 AO3 原有页面 |

## 测试数据

- 准备若干 AO3 真实页面的 HTML 快照作为 fixture
- 覆盖：列表页、作品详情页、无 tag 的边界情况
- 保存在 `tests/fixtures/` 目录下
