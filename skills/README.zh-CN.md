# Claude Code Skills

[English](README.md) | 简体中文

为 Zotero Obsidian Linker 配套的 [Claude Code](https://claude.com/claude-code)
skill。它们建立在 linker 写入每篇笔记的 frontmatter（`zotero_pdf_key`、
`zotero_item_key` 等）之上。

## read-paper

论文精读工作流。给出论文名 / 笔记文件 / PDF 路径后，Claude 会：

1. 在 vault 里定位文献笔记，并从其 frontmatter 的 `zotero_pdf_key`
   （由本插件写入）解析出本地 PDF；
2. 分块读完 PDF；
3. 把结构化分析写回笔记的 `## Notes` 区——八段骨架（速览 / 研究问题 /
   核心贡献 / 方法 / 实验 / 批判性评价 / 局限与启发）+ 对关键设计决策做
   "为什么这么设计、为什么不那样做"式的核心机制深挖；
4. 可按 vault 的附件管理规则，把论文里的方法 / 架构图裁出并嵌进笔记；
5. 支持模式二（`/read-paper consolidate`）：把精读后的追问讨论提炼成
   独立「讨论提炼」区写回同一篇笔记。

安全保证：生成内容包在 `<!-- ai-read-paper:start/end -->` 标记内；
重跑只替换标记之间的内容；**绝不覆盖手写笔记**。

### 依赖

- 任一支持开放 [Agent Skills](https://agentskills.io) 格式的 agent——
  本 skill 在 [Claude Code](https://claude.com/claude-code) 上开发与测试；
  也可装进 OpenAI Codex CLI 等兼容此格式的 agent（见下方说明）
- Zotero，且 PDF 附件存在本地（默认 `~/Zotero/storage`）
- 由 Zotero Obsidian Linker 生成的 Obsidian 笔记
- [poppler](https://poppler.freedesktop.org/)（`pdfinfo`、`pdftotext`、
  `pdftocairo`）—— `brew install poppler` / `apt install poppler-utils`
- Python 3 + [Pillow](https://python-pillow.org/)（仅裁图功能需要）

### 安装

**Claude Code：**

```bash
cp -r skills/read-paper ~/.claude/skills/
```

**OpenAI Codex CLI**（或其他兼容 Agent Skills 的 agent——参见
[Codex skills 文档](https://developers.openai.com/codex/skills)）：

```bash
cp -r skills/read-paper ~/.codex/skills/
```

然后打开装好的 `SKILL.md`，把开头的 **「## 配置」** 节改成你自己的——
笔记目录、vault 根、研究方向等。所有机器相关的设置都集中在那一节。

对非 Claude agent 的可移植性说明：frontmatter 里的 `allowed-tools` 是
Claude Code 扩展字段，其他 agent 会安全忽略；指令中用 Claude Code 内置
`Read` 工具分页读 PDF / 查看图片的地方，其他 agent 退用 poppler 工具链
（本就是依赖）——skill 里已写好回退命令。

新开一个会话即可使用：

```text
/read-paper <论文名>           # 完整精读
/read-paper <论文名> quick     # 只写骨架
/read-paper consolidate        # 把追问讨论提炼回笔记
/read-paper fig <论文名>       # 按需裁图嵌入
```

### 语言

skill 指令与笔记模板为中文，产出中文笔记、术语保留英文（作者的记笔记
习惯）。若你用其他语言记笔记，改 `SKILL.md` Step 6 的模板与书写规矩
即可——工作流本身与语言无关。

### 目录结构

```text
read-paper/
├── SKILL.md                       # 主流程 + 配置节
└── references/                    # 按需加载
    ├── figure-extraction.md       # 裁图 / 命名 / 嵌入
    ├── consolidate.md             # 模式二 · 讨论固化
    └── example-analysis.md        # 分析深度校准样例
```
