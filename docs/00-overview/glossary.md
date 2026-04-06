# 术语表

## 产品术语

| 术语 | 含义 |
|---|---|
| highlight（高亮） | 正向强调 tag，表示用户喜欢 |
| warn（警示） | 在作品卡片上显示警告，表示有雷点 |
| mute（弱化） | 降低 tag 视觉存在感，表示噪音 |
| hideWork（折叠作品） | 将整个作品折叠为占位条，表示强雷点 |
| rule（规则） | 用户定义的一条匹配规则，包含 pattern + action + matchMode + category |
| quick add（快速添加） | 从页面 tag 上直接一键创建规则 |

## 匹配术语

| 术语 | 含义 |
|---|---|
| exact | 精确匹配，tag 文本完全等于 pattern |
| contains | 包含匹配，tag 文本包含 pattern |
| wildcard | 通配符匹配，`*` 代表任意字符 |
| category | tag 分类：relationship / character / freeform |

## 技术术语

| 术语 | 含义 |
|---|---|
| content script | 注入 AO3 页面的脚本 |
| service worker | MV3 的 background 脚本，非持久化 |
| popup | 点击扩展图标弹出的小窗口 |
| options page | 扩展的完整设置页面 |
| Shadow DOM | 用于样式隔离的 Web API，防止注入样式和宿主页面样式互相干扰 |
| ParsedTag | 解析后的 tag 对象 |
| ParsedWork | 解析后的作品对象 |
| MatchResult | 规则引擎输出的命中结果 |
