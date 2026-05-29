# 06 — Options 规则管理页

对应 checklist：H1（规则列表）、H2（搜索筛选）、H3（新增规则）、H4（编辑规则）、H5（删除规则）、H6（启停规则）

## 涉及文件

| 文件 | 职责 |
|---|---|
| `src/options/optionsApp.ts` | options 可测试控制器 |
| `src/options/index.ts` | options 入口，只负责启动 app |
| `src/options/options.css` | options 页面样式 |
| `src/storage/ruleStorage.ts` | 规则 CRUD 与更新通知 |

## 当前行为

Options 页面提供完整 MVP 规则管理：

- 展示全部规则，并显示规则总数
- 按 pattern 搜索
- 按 action 筛选：all / highlight / warn / mute / hideWork
- 新增规则
- 编辑规则
- 删除规则，删除前确认
- 启停规则
- storage 操作失败时显示错误并保留页面可用

规则写操作均调用 storage 层 API。storage 层负责校验和发送 `RULES_UPDATED`，background 会广播到 AO3 tabs。

## Public Controller

```typescript
export interface OptionsAppDeps {
  listRules(): Promise<Rule[]>;
  addRule(input: RuleCreateInput): Promise<Rule>;
  updateRule(id: string, patch: RuleUpdateInput): Promise<Rule>;
  deleteRule(id: string): Promise<void>;
  toggleRule(id: string): Promise<Rule>;
  confirmDelete(rule: Rule): boolean;
  alertError(message: string): void;
  logError(error: unknown): void;
}

export async function renderOptionsApp(
  container: HTMLElement,
  deps?: OptionsAppDeps
): Promise<void>;
```

## 表单字段

新增/编辑表单只覆盖 MVP 字段：

```typescript
{
  pattern: string;
  action: "highlight" | "warn" | "mute" | "hideWork";
  matchMode: "exact" | "contains" | "wildcard";
  category: "all" | "relationship" | "character" | "freeform";
  enabled: boolean;
}
```

新增规则会写入 `source: "manual"`。编辑已有规则时，`source`、`note`、`groupId` 等非表单字段由 storage merge 保留。

## 当前不做

- 不做规则导入/导出
- 不做分组管理
- 不做高级样式设置
- 不做批量操作
- 不做复杂 boolean 规则表达式
