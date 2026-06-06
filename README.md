# Zotero Obsidian Linker

Create or update an Obsidian literature note from a Zotero item, then add a Zotero child URI attachment that opens the note in Obsidian.
If invoked from a PDF attachment, the plugin resolves the parent Zotero item first and adds the Obsidian URL as a sibling child attachment under that item.

## Install

1. Run `./build.sh`.
2. In Zotero, open `Tools -> Plugins`.
3. Choose `Install Plugin From File...`.
4. Select the generated `.xpi` in `dist/`, for example `dist/zotero-obsidian-linker-0.2.4.xpi`.
5. Restart Zotero if prompted.

The manifest currently supports Zotero `6.999` through `10.*`.
By default, `./build.sh` writes `updates.json` with a GitHub Releases URL.
For local update-manifest testing, override it with `UPDATE_LINK=file:///absolute/path/to/plugin.xpi ./build.sh`.

Zotero 9 rejects plugin manifests that omit `applications.zotero.update_url`.
If Zotero says the plugin "may be incompatible" while `installError` is `-3`,
check that this field exists in `manifest.json`.
The `update_url` must also use HTTPS, because Zotero disables add-ons whose
updates are not provided securely.

## Use

1. Right-click a Zotero item or one of its PDF attachments.
2. Click `为条目新建/更新 Obsidian 笔记`.
3. On first use, choose your Obsidian note directory.

The plugin creates or updates a Markdown note for the Zotero item and adds an `Obsidian Note` URL child attachment under that same item. Triggering it from a PDF attachment still writes the link under the parent item, next to the PDF.
Use `Settings -> Obsidian Linker` or `Tools -> Obsidian Linker: Configure...` to change the note directory or filename template.
Disable `Show completion confirmation` to create/update notes without a success popup.
Enable `Trust obsidian:// links in Zotero` to reduce Zotero's external-protocol confirmation for Obsidian links.

The default filename template is:

```text
{{citekey}}.md
```

Supported template variables:

- `{{citekey}}`
- `{{title}}`
- `{{year}}`
- `{{firstAuthor}}`
- `{{itemKey}}`

## Output

The generated note contains frontmatter with Zotero and Obsidian links:

```yaml
---
citekey: ...
title: ...
authors:
  - ...
year: ...
doi: ...
url: ...
zotero_item: ...
zotero_item_key: ...
zotero_pdf: ...
zotero_pdf_key: ...
obsidian_uri: ...
---
```

It also adds a small link block near the top:

```markdown
<!-- zotero-obsidian-linker -->
[Zotero 条目](...) | [原文 PDF](...)
<!-- /zotero-obsidian-linker -->
```

If the note already exists, the plugin updates the frontmatter/link block and leaves the rest of the note body intact.
