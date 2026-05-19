# 09 — CSS 样式参考

对应文件：`src/styles/content.css`

## 设计原则

1. **所有 class 使用 `ao3th-` 前缀** — 避免和 AO3 原生 CSS 冲突
2. **效果不能太重** — AO3 本身有丰富的视觉元素，插件的样式应该是辅助性的增强
3. **不使用 `!important`** — 除非 AO3 的 CSS 特异性太高导致样式被覆盖

## 颜色方案

AO3 的配色偏暖红（`#900`），插件样式应避免使用相近颜色造成混淆。

| Action | 主色 | 含义 |
|---|---|---|
| highlight | `#2ecc71` 绿色系 | 正向：感兴趣的 tag |
| mute | `#bdc3c7` 灰色系 | 中性：降低存在感 |
| warn | `#e74c3c` 红色系 | 负向：危险 / 雷点 |
| hideWork | `#95a5a6` 灰色 | 整个作品被折叠 |

## content.css 完整参考

```css
/* ========================================
   AO3 Tag Highlighter — Content Script CSS
   ======================================== */

/* --- Tag 级效果 --- */

.ao3th-highlight {
  background-color: rgba(46, 204, 113, 0.25) !important;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px rgba(46, 204, 113, 0.4);
  transition: background-color 0.2s;
}

.ao3th-mute {
  opacity: 0.4 !important;
  filter: grayscale(50%);
  transition: opacity 0.2s;
}

.ao3th-mute:hover {
  opacity: 0.7;
}

.ao3th-warn {
  background-color: rgba(231, 76, 60, 0.2) !important;
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px rgba(231, 76, 60, 0.4);
  transition: background-color 0.2s;
}

.ao3th-hide-work {
  opacity: 0.3 !important;
  text-decoration: line-through;
}

/* --- Work 级效果 --- */

.ao3th-work-warn {
  border-left: 4px solid #e74c3c !important;
  background-color: rgba(231, 76, 60, 0.04) !important;
  transition: border-color 0.2s, background-color 0.2s;
}

.ao3th-work-hidden {
  /* display: none 由 JS 控制，不在 CSS 中设置，
     因为需要 JS 来同步管理占位条 */
}

/* --- 折叠占位条 --- */

.ao3th-collapse-placeholder {
  padding: 12px 16px;
  background: #f5f5f5;
  border: 1px dashed #ccc;
  border-radius: 4px;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 0.643em; /* 与 AO3 的 li.work 间距匹配 */
  text-align: center;
  transition: background 0.2s, color 0.2s;
  list-style: none; /* 如果在 ol/ul 内 */
}

.ao3th-collapse-placeholder:hover {
  background: #eee;
  color: #555;
}

/* --- Toast --- */

.ao3th-toast {
  padding: 10px 16px;
  background: #333;
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: auto;
  max-width: 300px;
  word-break: break-word;
}

.ao3th-toast.visible {
  opacity: 1;
  transform: translateY(0);
}
```

## 与 AO3 的 DOM 结构匹配

### 列表页作品卡片

AO3 列表页的作品结构：

```html
<ol class="work index group">
  <li class="work blurb" id="work_12345">
    <div class="header module">...</div>
    <ul class="tags commas">
      <li class="relationships">
        <a class="tag" href="...">Character A/Character B</a>
      </li>
      <li class="characters">
        <a class="tag" href="...">Character A</a>
      </li>
      <li class="freeforms">
        <a class="tag" href="...">Fluff</a>
      </li>
    </ul>
    ...
  </li>
</ol>
```

- Tag 级 class（`ao3th-highlight` 等）加在 `<a class="tag">` 上
- Work 级 class（`ao3th-work-warn`）加在 `<li class="work blurb">` 上
- 折叠占位条插入到 `<li class="work blurb">` 的 `afterend`

### 作品详情页

```html
<div id="workskin">
  ...
</div>
<dl class="work meta">
  <dd class="relationship tags">
    <ul>
      <li><a class="tag" href="...">Character A/Character B</a></li>
    </ul>
  </dd>
  <dd class="character tags">...</dd>
  <dd class="freeform tags">...</dd>
</dl>
```

详情页的 tag 样式同样加在 `<a class="tag">` 上。work 级效果不太适用于详情页（用户已经点进来了），可以只做 tag 级效果。

## CSS 特异性考量

AO3 的 `<a class="tag">` 可能有如下样式来源：

1. AO3 默认 stylesheet
2. 用户自定义的 AO3 site skin
3. 其他浏览器扩展

如果插件的样式被覆盖，可以提升特异性：

```css
/* 更高特异性 */
li.relationships a.tag.ao3th-highlight,
li.characters a.tag.ao3th-highlight,
li.freeforms a.tag.ao3th-highlight {
  background-color: rgba(46, 204, 113, 0.25);
}
```

MVP 阶段先用简单选择器 + `!important`，如果出问题再提升特异性。

## 暗色模式兼容（可选）

AO3 有暗色 site skin（如 Reversi），颜色需要调整：

```css
/* 如果需要，可以通过检测 AO3 的 body class 来适配 */
body.dark .ao3th-highlight {
  background-color: rgba(46, 204, 113, 0.35);
}
```

MVP 阶段可以先不做，但要知道这个问题存在。

## content.css 的注入方式

参见 `03-content-entry.md` 和 `10-manifest-build.md`。推荐通过 manifest 的 `content_scripts.css` 声明注入：

```json
"content_scripts": [
  {
    "matches": ["https://archiveofourown.org/*"],
    "js": ["content/index.js"],
    "css": ["assets/content.css"]
  }
]
```

CSS 文件来自 `src/styles/content.css`，由 `content/index.ts` import 后经 Vite 输出到 `dist/assets/content.css`。
