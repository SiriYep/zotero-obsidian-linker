# Zotero Obsidian Linker

English | [简体中文](README.zh-CN.md)

Zotero Obsidian Linker is a Zotero plugin that creates and maintains Obsidian
Markdown notes for Zotero items. It keeps the Zotero item, the paper PDF, and
the Obsidian note connected with bidirectional links.

## Features

- Create or update an Obsidian literature note from a Zotero item.
- Trigger note creation from either a Zotero item or one of its PDF attachments.
- Add an `Obsidian Note` URL attachment under the Zotero parent item.
- Insert Zotero item and PDF links into the generated Markdown note.
- Use vault-relative Obsidian links when a vault root and vault name are configured.
- Preserve existing note content while refreshing metadata and managed links.
- Generate note filenames from a configurable template.
- Batch-normalize existing plugin-managed note filenames from the settings page.
- Optionally reduce Zotero confirmation prompts for `obsidian://` links.
- Show English or Simplified Chinese UI text based on the Zotero interface
  language.
- Ship a companion [Claude Code skill](skills/README.md) (`read-paper`) that
  deep-reads papers and writes structured analyses back into the generated
  notes.

## Compatibility

The manifest currently targets Zotero `6.999` through `10.*`.

The plugin is designed for modern Zotero builds that support the current plugin
manifest format and preference pane APIs. If Zotero reports that the plugin may
be incompatible, see [Troubleshooting](#troubleshooting).

## Installation

### Install from a release

1. Download the latest `.xpi` file from the repository releases.
2. Open Zotero.
3. Go to `Tools -> Plugins`.
4. Click the gear icon and choose `Install Plugin From File...`.
5. Select the downloaded `.xpi` file.
6. Restart Zotero if prompted.

### Build from source

```bash
./build.sh
```

The generated package is written to `dist/`, for example:

```text
dist/zotero-obsidian-linker-0.2.8.xpi
```

Install that file through Zotero's plugin manager.

## Quick Start

1. In Zotero, right-click a regular item or one of its PDF attachments.
2. Choose `Create/Update Item Obsidian Note`.
3. On first use, select the Obsidian folder where paper notes should be stored.

The plugin resolves PDF attachments to their parent Zotero item. The Obsidian
URL attachment is always added under the parent item, next to the PDF attachment.

## Settings

Open `Settings -> Obsidian Linker` in Zotero.

Available settings:

- `Note directory`: the folder where Markdown notes are created.
- `Vault root`: the root folder of the Obsidian vault that contains the note
  directory.
- `Vault name`: the Obsidian vault name used in `obsidian://open?vault=...`
  links. If you leave it empty after choosing a vault root, the plugin uses the
  vault root folder name.
- `Filename template`: the template used to generate note filenames.
- `Show completion confirmation`: show a completion popup after note creation.
- `Trust obsidian:// links in Zotero`: reduce external-protocol prompts for
  Obsidian links.
- `Normalize filenames...`: scan the note directory and rename plugin-managed
  Markdown notes using the current filename template.

## Filename Templates

The default filename template is:

```text
{{paperDate}}-{{shortTitle3}}-{{firstAuthor}}.md
```

Example output:

```text
260600-DemystifingVideoReasoning-Wang.md
```

Supported variables:

| Variable | Meaning |
| --- | --- |
| `{{paperDate}}` | Zotero item date as `YYMMDD`. Missing month or day is written as `00`: `2026` -> `260000`, `2026-06` -> `260600`, `2026-06-06` -> `260606`. |
| `{{noteDate}}` | Note creation date as `YYMMDD`. |
| `{{shortTitle3}}` | First three significant title words in compact title case. |
| `{{citekey}}` | Zotero native citation key, or a fallback item key. |
| `{{title}}` | Full Zotero title. |
| `{{year}}` | Four-digit year extracted from the Zotero item date. |
| `{{firstAuthor}}` | Last name of the first author. |
| `{{itemKey}}` | Zotero item key. |

The plugin sanitizes filenames for filesystem safety and appends `.md` if the
template does not include it.

## Batch Filename Normalization

Use `Normalize filenames...` from the plugin settings to migrate existing notes
to the current filename template.

The batch normalizer:

- recursively scans the selected note directory for `.md` files;
- only processes notes with Zotero Obsidian Linker metadata;
- resolves each note back to its Zotero item before renaming;
- skips files whose Zotero item cannot be resolved;
- preserves the note body;
- rewrites the managed frontmatter and Zotero link block;
- updates the Zotero `Obsidian Note` URL attachment;
- refreshes `obsidian_uri` to the current vault-relative link format when
  possible;
- avoids overwriting existing files by adding an item-key suffix on conflicts.

After a batch run, a summary is shown in Zotero. Details are written to the
system temporary directory, and the exact log path is shown in the summary.

## Generated Notes

A generated note contains YAML frontmatter with Zotero and Obsidian metadata:

```yaml
---
citekey: ...
title: ...
authors:
  - ...
year: ...
paper_date: ...
note_date: ...
note_path: ...
doi: ...
url: ...
zotero_item: ...
zotero_item_key: ...
zotero_pdf: ...
zotero_pdf_key: ...
obsidian_uri: ...
---
```

The plugin also inserts a small managed link block near the top of the note:

```markdown
<!-- zotero-obsidian-linker -->
[Zotero Item](...) | [PDF](...)
<!-- /zotero-obsidian-linker -->
```

When updating an existing note, the plugin replaces the frontmatter and managed
link block while preserving the rest of the note body.

## AI Paper Reading (Claude Code Skill)

The notes generated by this plugin are ready to use with the bundled
[`read-paper`](skills/README.md) skill for [Claude Code](https://claude.com/claude-code).
Once installed, you can say `/read-paper <paper name>` and Claude will:

- locate the literature note and resolve the local PDF through the
  `zotero_pdf_key` frontmatter shown above;
- read the PDF in chunks and write a structured deep-read analysis back into
  the note's `## Notes` section — overview, contributions, a figure-by-figure
  method walkthrough (with the architecture figure cropped from the PDF and
  embedded), experiments, critical review, and a "why this design, why not
  the obvious alternative" deep-dive;
- keep all generated content inside `<!-- ai-read-paper -->` markers, so
  re-running updates in place and **handwritten note content is never
  overwritten**;
- optionally distill a follow-up discussion back into the same note with
  `/read-paper consolidate`.

The skill uses the open [Agent Skills](https://agentskills.io) format, so
besides Claude Code it can also be installed in OpenAI Codex CLI and other
compatible agents.

See [skills/README.md](skills/README.md) for requirements, installation, and
usage details.

## Obsidian Links

Generated notes prefer vault-relative Obsidian links:

```text
obsidian://open?vault=<vault-name>&file=<path-inside-vault>
```

For example, if the vault root is `Research`, the note directory is
`Research/Paper Reading`, and the note is
`260600-DemystifingVideoReasoning-Wang.md`, the generated link points to:

```text
obsidian://open?vault=Research&file=Paper%20Reading%2F260600-DemystifingVideoReasoning-Wang.md
```

This mirrors the way Zotero links use Zotero item keys instead of local PDF
paths: another device can open the same note as long as Obsidian has a vault
with the same name and the note has the same path inside that vault.

If `Vault root` is empty, or the note directory is not inside the configured
vault root, the plugin falls back to an absolute `obsidian://open?path=...`
link.

Zotero may ask for confirmation before opening external protocol links. Enabling
`Trust obsidian:// links in Zotero` sets Zotero protocol preferences to reduce
those prompts. This only affects Zotero's handling of `obsidian://` links.

## Development

Build the plugin package:

```bash
./build.sh
```

The build script:

- reads the version from `manifest.json`;
- creates `dist/zotero-obsidian-linker-<version>.xpi`;
- updates `updates.json` with a GitHub Releases download URL and SHA-256 hash.

For local update-manifest testing, override the update link:

```bash
UPDATE_LINK=file:///absolute/path/to/plugin.xpi ./build.sh
```

## Privacy

The plugin stores the configured note directory, vault root, and vault name in
Zotero preferences on the local machine. Generated notes contain Zotero item
links, PDF links, and an Obsidian URI so that the two applications can open each
other.

When vault-relative links are available, generated notes store only the
vault-relative `note_path` and `obsidian://open?vault=...&file=...` URI. They do
not need to contain the local absolute vault path. If the plugin falls back to
`obsidian://open?path=...`, the generated note necessarily contains that
absolute local file path.

The repository and packaged plugin do not need to contain a user's local
Obsidian vault path.

## Troubleshooting

### Zotero says the plugin may be incompatible

Check `manifest.json` and make sure `applications.zotero.update_url` exists and
uses HTTPS. Zotero rejects or disables add-ons whose update metadata is missing
or insecure.

### The context menu does not show the create/update command

Restart Zotero after installing or updating the plugin. Then right-click a
regular Zotero item or one of its PDF attachments.

### A batch normalization run reports skipped files

Skipped files are usually Markdown files that do not contain plugin metadata, or
plugin notes whose Zotero item can no longer be resolved. The plugin skips them
to avoid renaming unrelated notes or breaking links.

### A batch normalization run reports conflicts

The target filename already existed. The plugin avoids overwriting it by adding
the Zotero item key to the generated filename.
