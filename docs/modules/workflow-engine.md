# 工作流引擎模块

> DAG 可视化工作流编辑与执行，多 Agent 协作自动化

## 1. 模块概览

工作流引擎允许用户在可视化编辑器中构建 DAG (有向无环图) 工作流，将多个 AI Agent 节点、条件分支、合并节点连接成自动化处理管道。支持手动触发、定时 (cron)、文件变更、剪贴板和全局快捷键触发。

## 2. 节点类型

| 类型 | 图标 | 功能 | 配置 |
|------|------|------|------|
| `input` | 入口 | 工作流输入 | `label`, `defaultValue` |
| `agent` | AI | 调用 AI Agent 处理 | `agentId`, `systemPrompt`, `model` |
| `condition` | 分支 | 条件路由 | `rules: { pattern, type: 'keyword'/'regex', targetPort }[]` |
| `merge` | 合并 | 合并多个分支 | `strategy: 'concat'/'first'/'custom'` |
| `output` | 出口 | 工作流输出 | `label` |

## 3. 工作流数据结构

```typescript
interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  icon: string;                      // emoji
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  triggers?: WorkflowTrigger[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowNode {
  id: string;
  type: 'input' | 'agent' | 'condition' | 'merge' | 'output';
  label: string;
  position: { x: number; y: number };
  config: Record<string, any>;       // 节点类型特定配置
}

interface WorkflowEdge {
  id: string;
  source: string;                    // 源节点 ID
  target: string;                    // 目标节点 ID
  sourceHandle?: string;             // 条件节点的输出端口
  label?: string;
}

interface WorkflowTrigger {
  type: 'manual' | 'cron' | 'file-change' | 'clipboard' | 'shortcut';
  config: {
    cronExpr?: string;               // cron 表达式
    watchPath?: string;              // 监控路径
    clipboardRegex?: string;         // 剪贴板匹配正则
    shortcutKeys?: string;           // 快捷键组合
  };
  enabled: boolean;
}
```

## 4. 执行引擎

### 4.1 执行流程

```
executeWorkflow(workflowId, input)
    │
    ├─ 1. 加载 WorkflowConfig
    │
    ├─ 2. 图验证
    │     ├─ DAG 检查 (无环检测, DFS 三色算法)
    │     ├─ 连通性验证
    │     └─ 必要节点检查 (至少 1 个 input + 1 个 output)
    │
    ├─ 3. 拓扑排序 (Kahn 算法)
    │     └─ 输出: 按层级分组的节点数组
    │         Layer 0: [input]
    │         Layer 1: [agent1, agent2]  ← 同层并行
    │         Layer 2: [condition]
    │         Layer 3: [merge]
    │         Layer 4: [output]
    │
    ├─ 4. 逐层执行
    │     └─ 同层节点 Promise.all 并行
    │
    └─ 5. 返回 WorkflowRun 结果
```

### 4.2 节点执行逻辑

**Agent 节点**:
```
收到上游输出 → 构建 prompt (systemPrompt + input)
    → Gateway RPC chat.send
    → 收集流式结果
    → 输出完整回复文本
```

**Condition 节点**:
```
收到上游输出 → 遍历 rules
    → 对每条 rule: keyword 包含检查 或 regex 匹配
    → 匹配的 rule 激活对应输出端口
    → 未匹配任何 rule → 默认端口 (如有)
```

**Merge 节点**:
```
等待所有激活的上游分支完成
    → concat: 拼接所有输入文本
    → first: 取第一个到达的结果
    → custom: 自定义模板合并
```

### 4.3 执行记录

```typescript
interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps: StepResult[];
  startedAt: string;
  completedAt?: string;
  finalOutput?: string;
  error?: string;
}

interface StepResult {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  input?: string;
  output?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}
```

## 5. 触发器系统

| 触发类型 | 实现 | 工作原理 |
|----------|------|----------|
| `manual` | UI 按钮 | 用户手动点击执行 |
| `cron` | `node-cron` | 按 cron 表达式定时触发 |
| `file-change` | `chokidar` | 监控文件/目录变化 |
| `clipboard` | 轮询 (2s 间隔) | 剪贴板内容匹配正则时触发 |
| `shortcut` | `globalShortcut` | 按下快捷键组合触发 |

## 6. 可视化编辑器

使用 `@xyflow/react` (React Flow) 库:

- 拖拽添加节点
- 连线定义数据流
- 节点配置面板 (侧边栏)
- 实时运行状态高亮 (绿色=完成, 蓝色=运行中, 红色=错误)
- 迷你地图导航
- 撤销/重做

### 预设模板 (6 个)

| 模板 | 节点数 | 用途 |
|------|--------|------|
| Translation Pipeline | 4 | 翻译管道 |
| Code Review Chain | 5 | 代码审查链 |
| Content Creation | 7 | 内容创作 (含条件+合并) |
| Research Assistant | 7 | 研究助手 (并行 Agent) |
| Email Classifier | 6 | 邮件分类 (含条件) |
| Daily Summary | 4 | 每日摘要 (cron 触发) |

## 7. 与 Live2D 融合

工作流执行时，Live2D 数字人实时反映状态:

| 事件 | 数字人反应 |
|------|-----------|
| 工作流开始 | "working" 循环动画 |
| Agent 节点处理 | "thinking" 表情 |
| 步骤完成 | 短暂 "nod" 动作 |
| 全部完成 | "celebrate" 动作 + "happy" 表情 |
| 执行失败 | "sad" 表情 |
| 进度更新 | 气泡显示当前步骤 (3/5) |

---

*最后更新: 2026-02-20*
