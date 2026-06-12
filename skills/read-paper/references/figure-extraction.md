# 插图提取与嵌入（裁论文原图 → 笔记）

> 本文件是**唯一**的裁图流程，SKILL.md 主文件里不再有第二套规则。
> `$VAULT_ROOT` / `$NOTES_DIR` / 依赖工具见 SKILL.md 配置节。

## 触发（两种）

1. **方法主图**：模式一写「四、方法」时，把你判断出的那张方法 / 架构 / pipeline 图提取到该节开头（哪张由你判断、不一定 Fig 2；没有合适方法图就跳过整块——判据见 SKILL.md Step 6「先图后文」）。
2. **用户点名**：用户说"给方法节配个图""把 Figure X 裁进来""插图"之类，或 `/read-paper fig <论文名>`。

两种触发的裁图 + 命名规则**完全相同**，只是**嵌入位置**不同（见「嵌入位置」）。

## 工具

只依赖 poppler（`pdftocairo` 渲染）+ `python3` + Pillow（`Image.crop((left, top, right, bottom))` 裁切），跨平台。
不需要 ImageMagick / PyMuPDF。macOS 的 `sips` 只适合看尺寸——它的裁切是居中裁、不便定点，别用它裁。

## 裁图流程

1. **高清渲染目标页**（300 DPI、PNG；不确定图在第几页就先 Read PDF 那几页看一眼）：
   ```bash
   mkdir -p /tmp/figcrop
   pdftocairo -png -r 300 -f <页> -l <页> "<pdf 路径>" /tmp/figcrop/p
   ```
2. **定位边界**：Read 渲出的整页，**目测**图的上下左右像素包围盒；先裁一大条出来再目测精调也行。
3. **精裁**：用 Pillow 裁。**拿不准就用像素量、别纯靠肉眼**——把候选裁块转灰度后按行扫描暗像素数，取「第一条 / 最后一条非白行」即真实上下墨迹边界，各留 ~10–20px 呼吸位再裁；caption 末行与正文首行之间通常有一段明显更大的行间空白，用它区分二者（正文别裁进来）。
   - **上下两边都要对齐图的真实墨迹，别只收一边**：**顶部**别把论文页约 0.8″ 的**纸张上边距**裁进来（整页第一处内容往往就是图顶）；**底部**别切到 caption 末行的 **descender**（`g`/`p`/`y` 的下沿），也别越界吃进下方正文。
   - 含图自己的 caption 更自包含。
4. **复核（护栏 A，必做）**：裁完**再 Read 一眼**——图要完整、不溢到邻图、白边小。靠坐标盲裁十有八九切边，宁可多留白边也别切内容；不对就调坐标重裁，直到干净。

## 命名与存放（复刻 vault 的附件管理规则，别随手丢笔记旁）

**主指令：规则以 vault 配置文件为准，动手前先读这两个文件、按映射推导**（设置可能变，别信记忆里的旧值）：

1. `$VAULT_ROOT/.obsidian/plugins/attachment-management/data.json`（若装了 [attachment-management](https://github.com/trganda/obsidian-attachment-management) 插件）
   - png 若有 `extensionOverride` 条目 → 用其 `attachmentPath` / `attachFormat` / `dateFormat`；否则用顶层同名字段。
   - 模板变量：`${notepath}` = 笔记相对 vault 根的**父目录**；`${notename}` = 笔记名去 `.md`；`${date}` 按 `dateFormat`（moment 格式）生成。
   - 注：插件本身无法从命令行触发（除非装了 Local REST API 之类），所以要**手动复刻**其规则、让结果与插件一致——否则插件下次被触发时会把附件改名搬走，链接就断了。
2. `$VAULT_ROOT/.obsidian/app.json`
   - `attachmentFolderPath` 作为附件根目录（如 `Attachment`）。
   - `useMarkdownLinks` 未设或 false → 用 wikilink `![[…]]`；true → 用 markdown 链接。
3. **没装 attachment-management** 的 vault → 回退：直接放 `app.json` 的 `attachmentFolderPath` 下，文件名自拟（仍要无空格、带笔记名前缀）。

**推导结果示例**（一种常见配置，仅示意映射关系；以你 vault 的实际文件为准）：
- `data.json` 里 png 的 `attachmentPath` = `${notepath}/${notename}`、`attachFormat` = `IMG-${notename}-${date}`、`dateFormat` = `YYYYMMDDHHmmssSSS`，`app.json` 的 `attachmentFolderPath` = `Attachment` ⇒
- **目标目录**：`$VAULT_ROOT/Attachment/<笔记父目录>/<笔记名去掉.md>/`
- **文件名**：`IMG-<笔记名>-<时间戳>.png`，时间戳 17 位含毫秒，
  生成：`python3 -c "from datetime import datetime; print(datetime.now().strftime('%Y%m%d%H%M%S%f')[:-3])"`
- **嵌入写法**：wikilink `![[IMG-<笔记名>-<时间戳>.png]]`（文件名唯一，直接用名即可），下面配一行 caption（可用 `> **Figure N** · 一句话说明这图在讲什么`）。

## 嵌入位置

- **方法主图** → 「四、方法」**最开头**（在 `ai-read-paper` 区块**内**；它本就由 skill 每次重写时一并生成，不怕被覆盖）。
- **按需的其他图** → 放 `## Notes` 下、`ai-read-paper` 标记**之外**（之前），这样重跑 /read-paper 不会把它冲掉。

## 护栏（都踩过，逐条遵守）

- **A · 裁切边界**：必须 Read 裁出的图肉眼复核（流程第 4 步）；拿不准用像素行扫描定边界（流程第 3 步）。
- **B · 链接卫生**：文件名**无空格**、用 `![[ ]]` wikilink（免 URL 转义）、`IMG-<笔记名>-` 前缀天然绑定笔记、防跨篇重名。
- **C · 覆盖竞态**：方法主图嵌在 `ai-read-paper` 区块内，**模式一重读会 regenerate 整块、把图链接冲掉** → 重读时（SKILL.md Step 7 已写）先扫旧块里的 `![[...]]` / `![](...)`、记下所在小节，regenerate 后原样补回。
- **复用、别重裁**：重跑 /read-paper 会重写「四、方法」；若该笔记的附件目录已有方法主图，直接复用那个文件名嵌入，别再裁一张（否则时间戳变、留下重复文件）。
- **替换 / 覆盖已嵌入的图时，先读笔记当前链接名、别硬编码旧名**：attachment-management 插件会按自己的事件给附件**改名**（换新时间戳）并同步更新笔记里的 `![[...]]`；若沿用上一轮 / 记忆里的旧名 `cp`，会**凭空多一个文件、且笔记仍指旧图**。正确顺序：① `grep -o 'IMG-…\.png' "<笔记>"` 取**当前**引用名 `$REF`；② 新图 `cp` 进**那个确切文件名**；③ `find "<附件目录>" -maxdepth 1 -name 'IMG-*' ! -name "$REF" -delete` 清孤儿；④ 校验「链接 basename == 磁盘 basename」「文件在」「尺寸 / 字节符合预期」。云同步盘（iCloud 等）偶发目录瞬时不可见、命令报 `No such file`，**重查一次**再判断。
- **Obsidian 抢写**：Obsidian 若在运行且 `alwaysUpdateLinks=true`，用 Edit 改笔记可能与它竞争，报「modified since read」就**重读再试**。
- **认准 vault**：机器上常有多个 vault（嵌套 / 同名），附件一律存进 SKILL.md 配置节 `$VAULT_ROOT` 指定的那个。
