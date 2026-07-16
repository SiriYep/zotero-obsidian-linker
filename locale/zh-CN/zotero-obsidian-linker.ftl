zotero-obsidian-linker-pref-title = Obsidian Linker
zotero-obsidian-linker-alert-title = Zotero Obsidian Linker

zotero-obsidian-linker-create-note = 为条目新建/更新 Obsidian 笔记
zotero-obsidian-linker-open-settings = 打开 Obsidian Linker 设置

zotero-obsidian-linker-settings-title = 设置
zotero-obsidian-linker-note-dir-label =
    .value = 笔记目录
zotero-obsidian-linker-vault-root-label =
    .value = Vault 根目录
zotero-obsidian-linker-vault-name-label =
    .value = Vault 名称
zotero-obsidian-linker-file-name-template-label =
    .value = 文件名模板
zotero-obsidian-linker-choose-button =
    .label = 选择...
zotero-obsidian-linker-vault-link-description = 如果笔记目录位于 vault 根目录内，Zotero 链接会使用 obsidian://open?vault=...&file=... 和 vault 内相对笔记路径。
zotero-obsidian-linker-supported-variables = 支持变量：{ "{{paperDate}}" }, { "{{noteDate}}" }, { "{{shortTitle3}}" }, { "{{citekey}}" }, { "{{title}}" }, { "{{year}}" }, { "{{firstAuthor}}" }, { "{{itemKey}}" }
zotero-obsidian-linker-normalize-file-names-button =
    .label = 规范化文件名...
zotero-obsidian-linker-normalize-file-names-description = 用当前模板重命名笔记目录中由插件管理的 Markdown 笔记。
zotero-obsidian-linker-show-success-alert =
    .label = 显示完成确认
zotero-obsidian-linker-trust-obsidian-links =
    .label = 信任 Zotero 中的 obsidian:// 链接

zotero-obsidian-linker-no-item-selected = 请选择一个 Zotero 条目，或者这个条目下面的 PDF 附件。
zotero-obsidian-linker-create-failed = 创建 Obsidian 笔记失败：
    { $error }
zotero-obsidian-linker-choose-note-dir-title = 选择 Obsidian 笔记目录
zotero-obsidian-linker-choose-vault-root-title = 选择 Obsidian vault 根目录
zotero-obsidian-linker-choose-note-dir-failed = 选择 Obsidian 笔记目录失败：
    { $error }
zotero-obsidian-linker-choose-vault-root-failed = 选择 Obsidian vault 根目录失败：
    { $error }
zotero-obsidian-linker-note-dir-required = 请先选择 Obsidian 笔记目录。

zotero-obsidian-linker-normalize-confirm = 扫描笔记目录，并使用当前文件名模板重命名插件管理的 Markdown 笔记？
zotero-obsidian-linker-normalize-summary =
    扫描文件数：{ $scanned }
    插件管理的笔记：{ $managed }
    已重命名：{ $renamed }
    已更新：{ $updated }
    未变化：{ $unchanged }
    已跳过：{ $skipped }
    已避免冲突：{ $conflicts }
    错误：{ $errors }
    详细日志已写入 { $logPath }
zotero-obsidian-linker-normalize-failed = 批量规范化文件名失败：
    { $error }

zotero-obsidian-linker-status-created = 已创建
zotero-obsidian-linker-status-updated = 已更新
zotero-obsidian-linker-status-renamed = 已重命名
zotero-obsidian-linker-link-zotero-item = Zotero Item
zotero-obsidian-linker-link-pdf = PDF
zotero-obsidian-linker-note-dir-missing = 笔记目录不存在：{ $directory }
zotero-obsidian-linker-filename-unavailable = 无法为 { $path } 找到可用文件名
