# 完成标准

## 通用标准

一个任务被视为"完成"，必须满足：

1. 相关文档已更新
2. `checklist.md` 中对应项已勾选
3. 代码可编译、lint 通过
4. 有测试的模块测试通过
5. `handoff.md` 反映当前状态和下一步

## 各模块验收清单

### 页面解析

- [ ] 能识别 AO3 支持页面类型
- [ ] 能识别 works 列表容器
- [ ] 能提取 relationship tags
- [ ] 能提取 character tags
- [ ] 能提取 freeform tags
- [ ] 每个 tag 知道自己属于哪个 work

### 匹配引擎

- [ ] exact 匹配正常
- [ ] contains 匹配正常
- [ ] wildcard 匹配正常
- [ ] category 限制正常
- [ ] disabled 规则不参与匹配
- [ ] 优先级解析正常（hideWork > warn > highlight > mute）

### 渲染

- [ ] highlight 样式正常
- [ ] mute 样式正常
- [ ] warn 应用于作品卡片，不只作用于 tag
- [ ] hideWork 默认 collapse，显示占位条
- [ ] 重算时不重复插入 DOM

### 页面交互

- [ ] hover 时能看到小按钮
- [ ] 点击按钮能打开菜单
- [ ] 选中菜单项能新建规则
- [ ] 页面立即更新
- [ ] Toast 正常显示

### Options 页面

- [ ] 能查看全部规则
- [ ] 能搜索规则
- [ ] 能新增规则
- [ ] 能编辑规则
- [ ] 能删除规则
- [ ] 能启停规则

### Popup

- [ ] 能显示当前页命中统计
- [ ] 全局开关正常
- [ ] 能跳转到 options
