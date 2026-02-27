# 技能市场模块

> ClawHub 技能生态，为 AI Agent 扩展工具能力

## 1. 模块概览

技能系统为 AI Agent 提供可扩展的工具能力。技能是 Agent 在对话中可以调用的"工具"——例如代码执行、文件操作、终端命令、网络搜索等。通过 ClawHub 市场可以发现和安装社区贡献的技能。

## 2. 技能架构

```
ClawHub 市场 (远程)
    │
    ├─ search(query)       搜索技能
    ├─ explore()           浏览热门
    ├─ install(slug)       安装到本地
    └─ uninstall(slug)     卸载
          │
          v
~/.openclaw/skills/ (本地)
    ├─ opencode/            内置: 代码执行
    ├─ python-env/          内置: Python 环境
    ├─ code-assist/         内置: 代码辅助
    ├─ file-tools/          内置: 文件操作
    ├─ terminal/            内置: 终端命令
    └─ community-skill/     市场安装的技能
```

## 3. 技能数据结构

```typescript
interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: string;            // emoji
  version: string;
  author: string;
  config?: SkillConfig;    // 可选的 API Key/环境变量配置
  isCore: boolean;         // 是否核心技能
  isBundled: boolean;      // 是否预装
  configurable: boolean;   // 是否有可配置项
}

interface SkillConfig {
  apiKey?: string;
  envVars?: Record<string, string>;
}

interface MarketplaceSkill {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  downloads: number;
  tags: string[];
  installed: boolean;
}
```

## 4. 技能管理操作

### Store: `useSkillsStore`

| Action | 描述 | IPC 通道 |
|--------|------|----------|
| `fetchSkills()` | 获取已安装技能列表 | `clawhub:listInstalled` |
| `enableSkill(id)` | 启用技能 | `skill:enable` |
| `disableSkill(id)` | 禁用技能 | `skill:disable` |
| `searchSkills(query)` | 搜索市场 | `clawhub:search` |
| `installSkill(slug)` | 安装技能 | `clawhub:install` |
| `uninstallSkill(slug)` | 卸载技能 | `clawhub:uninstall` |

### 技能配置

部分技能需要 API Key 或环境变量:

```
用户点击技能卡片 → SkillDetailDialog
    │
    ├─ Info 标签: 描述/版本/作者/来源
    │
    └─ Config 标签:
         ├─ API Key 输入框
         └─ 环境变量 Key-Value 编辑器
              │
              └─ 保存 → invoke('skill:updateConfig', { skillId, config })
                      → 写入 ~/.openclaw/openclaw.json
                      → restart_gateway()
```

## 5. 技能与 Agent 绑定

每个 Agent 可以选择启用哪些技能:

```typescript
interface AgentConfig {
  // ... 其他字段
  skillIds: string[];  // 绑定的技能 ID 列表
}
```

Agent 编辑器中提供技能多选:
- 显示所有已安装且已启用的技能
- 勾选要绑定到该 Agent 的技能
- AI 对话时，只有绑定的技能会暴露给模型

## 6. Python 运行环境

技能 (特别是社区技能) 通常是 Python 脚本。系统通过 `uv` (Rust 编写的 Python 包管理器) 管理 Python 环境:

```
uv 管理:
├─ Python 解释器 (独立安装, 不依赖系统 Python)
├─ 虚拟环境 (每个技能独立)
└─ 依赖安装 (requirements.txt)
```

### 首次安装流程 (Setup 向导 Step 4)

```
自动安装默认技能:
├─ opencode      代码执行
├─ python-env    Python 环境
├─ code-assist   代码辅助
├─ file-tools    文件操作
└─ terminal      终端命令

IPC: invoke('uv:install-all')
进度: UV 安装进度事件 → Progress 组件
```

## 7. UI 设计

### 两个标签页

**Installed 标签页**:
- 搜索栏 + 来源过滤 (All / Built-in / Marketplace)
- 技能卡片网格:
  - 图标 + 名称 + 描述
  - 启用/禁用 Switch
  - 卸载按钮 (仅市场安装的)
  - 点击 → 详情 Dialog

**Marketplace 标签页**:
- 搜索栏
- 市场技能卡片:
  - 名称 + 描述 + 作者
  - 安装/卸载按钮 (带 loading 动画)
- 安全提示横幅

---

*最后更新: 2026-02-20*
