# Code Review — 2026-05-04 全量代码审查

**审查范围：** `src/` 全部源码 + `public/manifest.json` + 构建配置
**基线状态：** lint ✅ | test 26/26 ✅ | build ✅

## 处理状态

**更新：** 2026-05-21

- F1 已修：详情页 workId 改为从 `/works/:id` 提取真实数字 ID
- F2/F3 已修：ruleEngine 预处理 enabled rules，提前标准化 pattern 并预编译 wildcard regex
- F4 已修：hideWork collapse 重渲染保留用户展开状态
- F5 已修：popup/options 输出为 `dist/popup.html` / `dist/options.html`
- F6 已修：content/index 接入 contentApp，完成 settings/rules → parser → ruleEngine → renderer 最小闭环；background 已实现 AO3 tab 消息中转

---

## Findings

### F1 — 详情页 workId 取值错误
- **严重度：** high / bug
- **文件：** `src/content/ao3Parser.ts` L73
- **描述：** `parseWorkDetailPage` 使用 `workskin.id`（值为字面量 `"workskin"`）作为 workId，而非 AO3 作品的真实数字 ID。导致详情页所有 tag 的 `workId` 和 `ParsedWork.id` 均为 `"workskin"`，规则匹配结果无法与实际作品关联。
- **修复方向：** 从 `window.location.pathname`（`/works/12345`）提取数字 ID，或查询页面中包含作品 ID 的其他元素。同步更新 `ao3Parser.test.ts` 中详情页测试用例。

### F2 — wildcard 正则每次调用重新编译
- **严重度：** high / performance
- **文件：** `src/core/wildcard.ts` L2-4
- **描述：** `matchesWildcardPattern` 每次调用都 `new RegExp(...)`。在 `works × tags × rules` 三重循环中，同一 pattern 会被重复编译上千次。
- **修复方向：** 添加缓存（如 `Map<string, RegExp>`）或在 `ruleEngine.matchRules` 中预编译所有 wildcard 规则的正则。

### F3 — ruleEngine 内层循环重复标准化 pattern
- **严重度：** medium / performance
- **文件：** `src/core/ruleEngine.ts` L19
- **描述：** `normalizeTagText(rule.pattern)` 在 tag 内层循环中对每条 rule 反复调用，应在进入 works 循环前预处理一次。
- **修复方向：** 在 `matchRules` 函数顶部对 `enabledRules` 做一次预处理，生成包含 `normalizedPattern`（以及 F2 中预编译正则）的中间结构。

### F4 — clearWorkEffects 破坏用户展开状态
- **严重度：** medium / bug
- **文件：** `src/content/workEffects.ts` L33-40
- **描述：** `clearWorkEffects` 无条件删除 `dataset.ao3thExpanded` 并移除 collapse placeholder，导致重新渲染（如规则/设置更新触发 re-render）时用户手动展开的作品被强制折叠回去。
- **修复方向：** 在 clear 时保留 `ao3thExpanded` 和 placeholder；仅当作品不再命中 hideWork 时才移除展开状态。或在 `renderMatches` 中做差量更新而非全量 clear-then-apply。

### F5 — manifest.json popup/options 路径不正确
- **严重度：** medium / config
- **文件：** `public/manifest.json` L20-22
- **描述：** `default_popup` 和 `options_page` 写的是 `src/popup/index.html` 和 `src/options/index.html`。Vite 构建后 HTML 输出到 `dist/src/popup/index.html`，但 manifest 中的路径是相对于 dist 根目录的，实际能工作——但暴露了源码目录结构。
- **修复方向：** 调整 vite.config.ts 的 rollup input 或 output 配置，将 HTML 输出扁平化到 `dist/popup.html` 和 `dist/options.html`，manifest 路径改为 `popup.html` / `options.html`。

### F6 — content/index.ts 无胶水逻辑
- **严重度：** high / stub
- **文件：** `src/content/index.ts` L1-3
- **描述：** 内容脚本入口仅 import CSS + console.info，未接入 parser → ruleEngine → renderer 管线。扩展加载后不会执行任何实际功能。
- **修复方向：** 依赖 E1/E2（storage）完成后实现：读取 rules + settings → `parseAo3Works(document)` → `matchRules(works, rules)` → `renderMatches(works, result, { hideWorkMode })`。属于"最小闭环"的最后一步。
- **处理状态：** 已处理。`src/content/index.ts` 现在启动 `contentApp`；`contentApp` 会读取 settings/rules、解析 AO3 页面、执行匹配并渲染，同时监听 `RULES_UPDATED` / `SETTINGS_UPDATED`。`src/background/backgroundApp.ts` 已实现更新消息到 AO3 tabs 的中转。

---

## 修复优先级建议

| 顺序 | Finding | 理由 |
|------|---------|------|
| 1 | F2 + F3 | 可一起做，预处理 enabledRules（标准化 + 编译正则） |
| 2 | F1 | 详情页核心 bug，阻塞详情页功能 |
| 3 | F4 | 影响用户体验，重渲染场景下会丢失交互状态 |
| 4 | F5 | 构建配置优化，不影响功能但影响产物整洁度 |
| 5 | F6 | 依赖 storage 实现（E1/E2），是最小闭环的收尾 |
