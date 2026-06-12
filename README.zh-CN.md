# Zotero Obsidian Linker

[English](README.md) | 简体中文

Zotero Obsidian Linker 是一个 Zotero 插件，用于从 Zotero 条目创建和维护
Obsidian Markdown 论文笔记。它会把 Zotero 条目、论文 PDF 和 Obsidian 笔记用双向链接连接起来。

## 功能

- 从 Zotero 条目创建或更新 Obsidian 论文笔记。
- 可以从 Zotero 条目或该条目下的 PDF 附件触发创建。
- 在 Zotero 父条目下添加一个 `Obsidian Note` URL 附件。
- 在生成的 Markdown 笔记中写入 Zotero 条目链接和 PDF 链接。
- 更新已有笔记时保留正文，只刷新元数据和插件管理的链接。
- 支持用可配置模板生成笔记文件名。
- 支持在设置页批量规范化已有插件笔记的文件名。
- 可选减少 Zotero 打开 `obsidian://` 链接时的外部协议确认提示。
- 附带一个 [Claude Code skill](skills/README.zh-CN.md)（`read-paper`），可对论文做 AI 精读并把结构化分析写回生成的笔记。

## 兼容性

当前 manifest 支持 Zotero `6.999` 到 `10.*`。

插件面向支持新版插件 manifest 和设置面板 API 的 Zotero 版本。如果 Zotero 提示插件可能不兼容，请参考
[故障排查](#故障排查)。

## 安装

### 从 Release 安装

1. 从仓库的 Releases 页面下载最新 `.xpi` 文件。
2. 打开 Zotero。
3. 进入 `Tools -> Plugins`。
4. 点击齿轮图标，选择 `Install Plugin From File...`。
5. 选择下载好的 `.xpi` 文件。
6. 如果 Zotero 提示需要重启，请重启 Zotero。

### 从源码构建

```bash
./build.sh
```

生成的插件包会写入 `dist/`，例如：

```text
dist/zotero-obsidian-linker-0.2.7.xpi
```

然后在 Zotero 插件管理器中安装这个文件。

## 快速开始

1. 在 Zotero 中右键一个普通条目，或该条目下的 PDF 附件。
2. 点击 `为条目新建/更新 Obsidian 笔记`。
3. 第一次使用时，选择用于保存论文笔记的 Obsidian 文件夹。

如果从 PDF 附件触发，插件会自动找到它的父 Zotero 条目。Obsidian URL 附件始终会添加到父条目下面，和 PDF 附件处在同一级。

## 设置

在 Zotero 中打开 `Settings -> Obsidian Linker`。

可用设置：

- `Note directory`：Markdown 笔记创建位置。
- `Filename template`：用于生成笔记文件名的模板。
- `Show completion confirmation`：创建或更新完成后显示确认弹窗。
- `Trust obsidian:// links in Zotero`：减少 Zotero 打开 Obsidian 链接时的外部协议提示。
- `Normalize filenames...`：扫描笔记目录，并用当前文件名模板批量重命名插件管理的 Markdown 笔记。

## 文件名模板

默认文件名模板是：

```text
{{paperDate}}-{{shortTitle3}}-{{firstAuthor}}.md
```

示例输出：

```text
260600-DemystifingVideoReasoning-Wang.md
```

支持的变量：

| 变量 | 含义 |
| --- | --- |
| `{{paperDate}}` | Zotero 条目日期，格式为 `YYMMDD`。缺失的月份或日期用 `00` 补齐：`2026` -> `260000`，`2026-06` -> `260600`，`2026-06-06` -> `260606`。 |
| `{{noteDate}}` | 笔记创建日期，格式为 `YYMMDD`。 |
| `{{shortTitle3}}` | 标题中前三个有信息量的词，压缩成紧凑的标题格式。 |
| `{{citekey}}` | Zotero 原生 citation key；如果没有则回退到 item key。 |
| `{{title}}` | Zotero 中的完整标题。 |
| `{{year}}` | 从 Zotero 条目日期中提取的四位年份。 |
| `{{firstAuthor}}` | 第一作者姓氏。 |
| `{{itemKey}}` | Zotero item key。 |

插件会自动清理文件名中的非法字符。如果模板没有包含 `.md`，插件会自动补上。

## 批量规范化文件名

在插件设置页点击 `Normalize filenames...`，可以把已有笔记迁移到当前文件名模板。

批量规范化会：

- 递归扫描所选笔记目录下的 `.md` 文件；
- 只处理带有 Zotero Obsidian Linker 元数据的笔记；
- 重命名前先把笔记反查到对应 Zotero 条目；
- 跳过无法解析 Zotero 条目的文件；
- 保留笔记正文；
- 重写插件管理的 frontmatter 和 Zotero 链接块；
- 更新 Zotero 条目下的 `Obsidian Note` URL 附件；
- 如果目标文件名冲突，会追加 Zotero item key，避免覆盖已有文件。

批量运行结束后，Zotero 会显示汇总结果。详细日志会写入：

```text
/tmp/zotero-obsidian-linker-batch-rename.log
```

## 生成的笔记

生成的笔记包含 YAML frontmatter，用于保存 Zotero 和 Obsidian 元数据：

```yaml
---
citekey: ...
title: ...
authors:
  - ...
year: ...
paper_date: ...
note_date: ...
doi: ...
url: ...
zotero_item: ...
zotero_item_key: ...
zotero_pdf: ...
zotero_pdf_key: ...
obsidian_uri: ...
---
```

插件还会在笔记顶部附近插入一个受管理的链接块：

```markdown
<!-- zotero-obsidian-linker -->
[Zotero 条目](...) | [原文 PDF](...)
<!-- /zotero-obsidian-linker -->
```

更新已有笔记时，插件会替换 frontmatter 和受管理的链接块，并保留其余正文内容。

## AI 论文精读（Claude Code Skill）

本插件生成的笔记可以直接配合仓库附带的 [`read-paper`](skills/README.zh-CN.md) skill 在
[Claude Code](https://claude.com/claude-code) 中使用。安装后，对 Claude 说
`/read-paper <论文名>`，它会：

- 定位文献笔记，并通过上面展示的 `zotero_pdf_key` frontmatter 解析出本地 PDF；
- 分块读完 PDF，把结构化精读分析写回笔记的 `## Notes` 区——速览、核心贡献、
  逐框拆解方法图（从 PDF 裁出架构图并嵌入笔记）、实验、批判性评价，以及
  "为什么这么设计、为什么不那样做"式的核心机制深挖；
- 所有生成内容都包在 `<!-- ai-read-paper -->` 标记内，重跑原地更新，
  **绝不覆盖手写笔记**；
- 还可以用 `/read-paper consolidate` 把精读后的追问讨论提炼回同一篇笔记。

该 skill 采用开放的 [Agent Skills](https://agentskills.io) 格式，除 Claude Code
外，也可以装进 OpenAI Codex CLI 等兼容此格式的 agent。

依赖、安装与用法详见 [skills/README.zh-CN.md](skills/README.zh-CN.md)。

## Obsidian 链接

生成的笔记使用 `obsidian://open?path=...` 链接，让 Zotero 能够打开对应的 Obsidian Markdown 文件。

Zotero 可能会在打开外部协议链接时弹出确认提示。启用 `Trust obsidian:// links in Zotero` 后，插件会调整 Zotero 的协议偏好设置，以减少这类提示。这个设置只影响 Zotero 对
`obsidian://` 链接的处理。

## 开发

构建插件包：

```bash
./build.sh
```

构建脚本会：

- 从 `manifest.json` 读取版本号；
- 创建 `dist/zotero-obsidian-linker-<version>.xpi`；
- 更新 `updates.json`，写入 GitHub Releases 下载链接和 SHA-256 hash。

如果需要本地测试 update manifest，可以覆盖下载链接：

```bash
UPDATE_LINK=file:///absolute/path/to/plugin.xpi ./build.sh
```

## 隐私

插件会把设置中的笔记目录保存在本机 Zotero preferences 中。生成的笔记会包含 Zotero 条目链接、PDF 链接和 Obsidian 文件 URI，这样两个应用才能互相打开对应内容。

仓库和打包后的插件不需要包含用户本地 Obsidian vault 路径。

## 故障排查

### Zotero 提示插件可能不兼容

检查 `manifest.json`，确认 `applications.zotero.update_url` 存在并且使用 HTTPS。Zotero 会拒绝或禁用缺少安全更新元数据的插件。

### 右键菜单里看不到创建/更新命令

安装或更新插件后请重启 Zotero。然后右键一个普通 Zotero 条目，或该条目下的 PDF 附件。

### 批量规范化时出现 skipped

通常是因为这些 Markdown 文件没有插件元数据，或者对应 Zotero 条目无法解析。插件会跳过它们，以避免误改普通 Obsidian 笔记或破坏链接。

### 批量规范化时出现 conflicts

说明目标文件名已经存在。插件不会覆盖已有文件，而是会在生成文件名后追加 Zotero item key。
