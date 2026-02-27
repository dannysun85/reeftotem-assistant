# 知识库 & RAG 模块

> 文档解析、向量化、语义检索，让数字人具备专业知识

## 1. 模块概览

知识库模块允许用户上传文档 (PDF/TXT/MD/DOCX/CSV/URL)，经过解析、分块、向量化后存入 sqlite-vec 向量数据库。AI 对话时自动检索相关知识注入 prompt，实现检索增强生成 (RAG)。

**全部由 Gateway sidecar (Node.js) 处理**，前端通过 Tauri 命令/Gateway RPC 调用。

## 2. 处理管道

```
文档输入                 解析              分块               向量化            存储
 PDF ─┐
 TXT ─┤              ┌─────────┐      ┌──────────┐      ┌───────────┐    ┌──────────┐
 MD  ─┼─ addDoc() ─> │ Parser  │ ──>  │ Chunker  │ ──>  │ Embedder  │ ─> │sqlite-vec│
 DOCX─┤              │pdf-parse│      │ 512 char │      │ MiniLM    │    │ cosine   │
 CSV ─┤              │mammoth  │      │ 50 overlap│     │ or API    │    │ similarity│
 URL ─┘              └─────────┘      └──────────┘      └───────────┘    └──────────┘
```

### 2.1 文档解析器

| 格式 | 解析库 | 输出 |
|------|--------|------|
| PDF | `pdf-parse` | 纯文本 + 页数/标题 metadata |
| DOCX | `mammoth` | 纯文本 (HTML → 去标签) |
| TXT/MD/CSV | 原生 `fs.readFile` | 原始文本 |
| URL | `@mozilla/readability` + `turndown` | Markdown |

### 2.2 文本分块

```typescript
interface ChunkConfig {
  chunkSize: number;     // 默认 512 字符
  chunkOverlap: number;  // 默认 50 字符
}
```

滑动窗口分块：每 `chunkSize` 字符切割，相邻块重叠 `chunkOverlap` 字符，保证上下文连续性。

### 2.3 Embedding 向量化

两种模式：

| 模式 | 模型 | 维度 | 速度 | 质量 |
|------|------|------|------|------|
| 本地 ONNX | `Xenova/all-MiniLM-L6-v2` | 384 | 快 (CPU) | 中等 |
| API | `text-embedding-3-small` (OpenAI 兼容) | 1536 | 取决于网络 | 高 |

API 模式分批处理，每批 32 个 chunk。

### 2.4 向量存储

使用 `better-sqlite3` + `sqlite-vec` 扩展：
- 每个知识库一个向量表: `vec_kb_{id}`
- 支持 cosine 相似度搜索
- 支持按文档 ID 删除向量

## 3. RAG 检索流程

```
用户提问: "量子计算的基本原理是什么?"
    │
    v
1. 向量化查询文本 → [0.12, -0.34, 0.56, ...]
    │
    v
2. 在所有关联 KB 的向量表中搜索
   SELECT * FROM vec_kb_{id}
   WHERE embedding MATCH ? ORDER BY distance LIMIT 10
    │
    v
3. 过滤低分结果 (score < threshold)
    │
    v
4. 按 token 预算裁剪 (max ~2000 tokens)
    │
    v
5. 返回 RAGResult[]

interface RAGResult {
  content: string;        // 分块内容
  documentName: string;   // 来源文档名
  knowledgeBaseName: string;
  score: number;          // 相似度分数 0-1
}
```

### RAG 注入格式

注入到 AI prompt 的格式：

```xml
<knowledge>
以下是从知识库检索到的相关信息:

[来源: 量子计算入门.pdf, 相关度: 0.92]
量子计算利用量子力学的叠加态和纠缠效应...

[来源: 物理学基础.md, 相关度: 0.85]
量子比特(qubit)是量子计算的基本单元...
</knowledge>

用户问题: 量子计算的基本原理是什么?
```

## 4. 前端接口

### Store: `useKnowledgeStore`

| Action | 描述 | Gateway RPC |
|--------|------|-------------|
| `fetchKnowledgeBases()` | 获取所有知识库 | `knowledge:list` |
| `createKnowledgeBase(kb)` | 创建知识库 | `knowledge:create` |
| `updateKnowledgeBase(id, updates)` | 更新配置 | `knowledge:update` |
| `deleteKnowledgeBase(id)` | 删除 (含所有文档和向量) | `knowledge:delete` |
| `fetchDocuments(kbId)` | 获取知识库的文档列表 | `knowledge:listDocuments` |
| `addDocuments(kbId, filePaths)` | 添加文档 (触发处理管道) | `knowledge:addDocument` |
| `addUrl(kbId, url)` | 添加 URL (爬取 → 解析 → 向量化) | `knowledge:addUrl` |
| `removeDocument(kbId, docId)` | 删除文档 (含向量) | `knowledge:removeDocument` |
| `searchKB(kbId, query)` | 语义搜索 | `knowledge:search` |
| `setWatchFolder(kbId, path)` | 设置文件夹监控 | `knowledge:setWatchFolder` |

### 文档处理进度事件

```typescript
// Gateway → Frontend 事件
interface DocumentProgressEvent {
  kbId: string;
  docId: string;
  stage: 'parsing' | 'chunking' | 'embedding' | 'storing' | 'complete' | 'error';
  progress: number;    // 0-100
  error?: string;
}
```

## 5. 文件夹监控

使用 `chokidar` 监控文件夹变化：

- 新文件添加 → 自动触发文档处理管道
- 文件删除 → 自动删除对应文档和向量
- 应用重启后自动恢复所有 watcher

## 6. 与 Live2D 融合

- RAG 检索到高分结果 (> 0.8) → 数字人 "confident" 表情
- RAG 无结果 → 数字人 "thinking" 表情 (表示靠自身知识回答)
- 文档处理中 → 数字人 "工作中" 动画

---

*最后更新: 2026-02-20*
