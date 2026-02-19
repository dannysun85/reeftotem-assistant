# Reeftotem Assistant 文档中心

> Reeftotem Assistant v0.2.0-alpha - 基于 Tauri + React 的 Live2D 语音助手应用

## 文档导航

### 入门

| 文档 | 说明 |
|------|------|
| [快速入门](./getting-started.md) | 项目安装、运行和基本使用说明 |
| [项目架构](./architecture.md) | 技术栈、模块结构和架构设计总览 |
| [项目评估报告](./project-evaluation.md) | 功能现状、风险与改进建议 |

### 使用指南

| 文档 | 说明 |
|------|------|
| [腾讯云语音服务配置](./guides/tencent-cloud-voice-setup.md) | 腾讯云 ASR/TTS 服务配置步骤 |
| [测试指南](./guides/testing-guide.md) | 语音交互功能测试步骤和故障排除 |
| [CI/CD 实施指南](./guides/cicd-guide.md) | 完整 CI/CD 自动化方案实施说明 |

### 开发计划

| 文档 | 说明 |
|------|------|
| [AI 数字人助手开发计划](./development/live2d-development-plan.md) | 双窗口架构、四阶段开发规划和里程碑 |
| [语音交互开发计划](./development/voice-interaction-plan.md) | 语音识别、合成、Live2D 同步集成计划 |

### 模块文档

| 文档 | 说明 |
|------|------|
| [Tauri 后端模块](./modules/tauri-backend.md) | Rust 后端窗口管理、托盘菜单、边缘检测 |

### 问题修复记录

| 文档 | 说明 |
|------|------|
| [Live2D 窗口透明度修复方案](./fixes/live2d-transparency-analysis.md) | 透明窗口问题分析和多种修复方案 |
| [Live2D 透明度修复实施步骤](./fixes/live2d-transparency-implementation.md) | 透明度修复的分阶段实施步骤 |
| [Tauri 前后端通信修复](./fixes/tauri-communication-fix.md) | 前端 invoke 无法到达后端的修复过程 |
| [WebSocket ASR 迁移](./fixes/websocket-asr-migration.md) | 从 REST API 迁移到 WebSocket 实时识别 |
| [音频转换修复](./fixes/audio-conversion-fix.md) | Float32 到 Int16 转换导致的 4007 错误修复 |

### 其他

| 文档 | 说明 |
|------|------|
| [模型显示修改备份](./backup-model-display.md) | 模型显示相关代码修改备份和恢复说明 |

## 项目结构

```
docs/
├── index.md                                    # 本文件 - 文档总索引
├── getting-started.md                          # 快速入门
├── architecture.md                             # 项目架构总览
├── project-evaluation.md                       # 项目评估报告
├── backup-model-display.md                     # 模型显示修改备份
├── guides/
│   ├── tencent-cloud-voice-setup.md            # 腾讯云语音配置
│   ├── testing-guide.md                        # 测试指南
│   └── cicd-guide.md                           # CI/CD 实施指南
├── development/
│   ├── live2d-development-plan.md              # AI数字人开发计划
│   └── voice-interaction-plan.md               # 语音交互开发计划
├── modules/
│   └── tauri-backend.md                        # Tauri后端模块文档
└── fixes/
    ├── live2d-transparency-analysis.md         # Live2D透明度问题分析
    ├── live2d-transparency-implementation.md   # Live2D透明度修复实施
    ├── tauri-communication-fix.md              # Tauri通信修复
    ├── websocket-asr-migration.md              # WebSocket ASR迁移
    └── audio-conversion-fix.md                 # 音频转换修复
```

## 相关资源

- **根目录 CLAUDE.md**: 项目 AI 使用指引和完整架构分析
- **根目录 AGENTS.md**: AI Agent 仓库使用规范
- **模块级 CLAUDE.md**: 各子模块目录下的 AI 上下文文档（保留在原位置）

---

*最后更新: 2026-02-19*
