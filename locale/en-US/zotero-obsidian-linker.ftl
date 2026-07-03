zotero-obsidian-linker-pref-title = Obsidian Linker
zotero-obsidian-linker-alert-title = Zotero Obsidian Linker

zotero-obsidian-linker-create-note = Create/Update Item Obsidian Note
zotero-obsidian-linker-configure = Obsidian Linker: Configure...

zotero-obsidian-linker-settings-title = Settings
zotero-obsidian-linker-note-dir-label =
    .value = Note directory
zotero-obsidian-linker-vault-root-label =
    .value = Vault root
zotero-obsidian-linker-vault-name-label =
    .value = Vault name
zotero-obsidian-linker-file-name-template-label =
    .value = Filename template
zotero-obsidian-linker-choose-button =
    .label = Choose...
zotero-obsidian-linker-vault-link-description = If the note directory is inside the vault root, Zotero links use obsidian://open?vault=...&file=... with a vault-relative note path.
zotero-obsidian-linker-supported-variables = Supported variables: { "{{paperDate}}" }, { "{{noteDate}}" }, { "{{shortTitle3}}" }, { "{{citekey}}" }, { "{{title}}" }, { "{{year}}" }, { "{{firstAuthor}}" }, { "{{itemKey}}" }
zotero-obsidian-linker-normalize-file-names-button =
    .label = Normalize filenames...
zotero-obsidian-linker-normalize-file-names-description = Rename plugin-managed Markdown notes in the note directory using the current template.
zotero-obsidian-linker-show-success-alert =
    .label = Show completion confirmation
zotero-obsidian-linker-trust-obsidian-links =
    .label = Trust obsidian:// links in Zotero

zotero-obsidian-linker-no-item-selected = Select a Zotero item, or a PDF attachment under an item.
zotero-obsidian-linker-create-failed = Failed to create Obsidian note:
    { $error }
zotero-obsidian-linker-choose-note-dir-title = Choose Obsidian note directory
zotero-obsidian-linker-choose-vault-root-title = Choose Obsidian vault root
zotero-obsidian-linker-markdown-template-prompt = Markdown filename template:
zotero-obsidian-linker-config-saved = Configuration saved.
    Directory: { $directory }
    Template: { $template }
zotero-obsidian-linker-choose-note-dir-failed = Failed to choose Obsidian note directory:
    { $error }
zotero-obsidian-linker-choose-vault-root-failed = Failed to choose Obsidian vault root:
    { $error }
zotero-obsidian-linker-note-dir-required = Please choose an Obsidian note directory first.

zotero-obsidian-linker-normalize-confirm = Scan the note directory and rename plugin-managed Markdown notes using the current filename template?
zotero-obsidian-linker-normalize-summary =
    Scanned: { $scanned }
    Managed notes: { $managed }
    Renamed: { $renamed }
    Updated: { $updated }
    Unchanged: { $unchanged }
    Skipped: { $skipped }
    Conflicts avoided: { $conflicts }
    Errors: { $errors }
    Details were written to { $logPath }
zotero-obsidian-linker-normalize-failed = Failed to normalize filenames:
    { $error }

zotero-obsidian-linker-status-created = created
zotero-obsidian-linker-status-updated = updated
zotero-obsidian-linker-status-renamed = renamed
zotero-obsidian-linker-link-zotero-item = Zotero Item
zotero-obsidian-linker-link-pdf = PDF
zotero-obsidian-linker-note-dir-missing = Note directory does not exist: { $directory }
zotero-obsidian-linker-filename-unavailable = Could not find available filename for { $path }
