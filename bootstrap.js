const MENU_ID = "zotero-obsidian-linker-create-note";
const MENU_SEPARATOR_ID = "zotero-obsidian-linker-separator";
const TOOLS_MENU_ID = "zotero-obsidian-linker-configure";
const TOOLS_SEPARATOR_ID = "zotero-obsidian-linker-tools-separator";
const ADDON_ID = "zotero-obsidian-linker@qiansiyuan.local";
const ITEM_MENU_REGISTRATION_ID = "zotero-obsidian-linker-item-menu-registration";
const TOOLS_MENU_REGISTRATION_ID = "zotero-obsidian-linker-tools-menu-registration";
const PREF_BRANCH = "obsidianLinker.";
const LINK_BLOCK_START = "<!-- zotero-obsidian-linker -->";
const LINK_BLOCK_END = "<!-- /zotero-obsidian-linker -->";
const DEFAULT_FILE_NAME_TEMPLATE = "{{citekey}}.md";
const PLUGIN_VERSION = "0.2.4";

var ObsidianLinker = {
  _windows: new Set(),
  _preferencePaneID: null,

  async startup() {
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise
    ].filter(Boolean));
    Zotero.ObsidianLinker = this;
    this.ensurePrefDefaults();
    this.applyTrustObsidianLinksPref();
    this.log("startup");
    await this.writeStartupMarker("startup");
    await this.registerPreferencePane();
    this.insertLocalizationForMainWindows();
    try {
      this.registerMenus();
    }
    catch (error) {
      Zotero.logError(error);
      this.log(`MenuManager registration failed: ${error && error.message ? error.message : error}`);
    }
    this.cleanupLegacyDOMMenus();
    await this.writeStartupMarker("startup-complete");
  },

  shutdown() {
    this.log("shutdown");
    this.unregisterMenus();
    this.unregisterPreferencePane();
    if (Zotero.ObsidianLinker === this) {
      delete Zotero.ObsidianLinker;
    }

    for (const win of this._windows) {
      this.removeFromWindow(win);
    }
    this._windows.clear();
  },

  registerMenus() {
    if (!Zotero.MenuManager) {
      this.log("Zotero.MenuManager unavailable; item menu was not registered");
      return;
    }

    this.unregisterMenus();

    Zotero.MenuManager.registerMenu({
      menuID: ITEM_MENU_REGISTRATION_ID,
      pluginID: ADDON_ID,
      target: "main/library/item",
      menus: [
        {
          menuType: "menuitem",
          l10nID: "zotero-obsidian-linker-create-note",
          onShown: (_event, context) => {
            this.setMenuLabel(context, "为条目新建/更新 Obsidian 笔记");
          },
          onCommand: (event, context) => {
            const win = event.target.ownerGlobal || Zotero.getMainWindow();
            const selectedItems = this.toItemArray(this.getMenuSourceItems(win, context));
            this.runCreateOrUpdateFromMenu(win, selectedItems);
          }
        }
      ]
    });

    Zotero.MenuManager.registerMenu({
      menuID: TOOLS_MENU_REGISTRATION_ID,
      pluginID: ADDON_ID,
      target: "main/menubar/tools",
      menus: [
        {
          menuType: "menuitem",
          l10nID: "zotero-obsidian-linker-configure",
          enableForTabTypes: ["library"],
          onShown: (_event, context) => {
            this.setMenuLabel(context, "Obsidian Linker：配置...");
          },
          onCommand: (event) => {
            void this.configure(event.target.ownerGlobal);
          }
        }
      ]
    });
  },

  setMenuLabel(context, label) {
    try {
      if (context && context.menuElem) {
        context.menuElem.setAttribute("label", label);
      }
    }
    catch (error) {
      Zotero.logError(error);
    }
  },

  insertLocalizationForMainWindows() {
    if (Zotero.getMainWindows) {
      for (const win of Zotero.getMainWindows()) {
        this.insertLocalization(win);
      }
      return;
    }

    const windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      this.insertLocalization(windows.getNext());
    }
  },

  insertLocalization(win) {
    try {
      if (win && win.MozXULElement && win.MozXULElement.insertFTLIfNeeded) {
        win.MozXULElement.insertFTLIfNeeded("zotero-obsidian-linker.ftl");
      }
    }
    catch (error) {
      Zotero.logError(error);
      this.log(`localization load failed: ${error && error.message ? error.message : error}`);
    }
  },

  unregisterMenus() {
    if (!Zotero.MenuManager) {
      return;
    }
    for (const menuID of [ITEM_MENU_REGISTRATION_ID, TOOLS_MENU_REGISTRATION_ID]) {
      try {
        Zotero.MenuManager.unregisterMenu(menuID);
      }
      catch (_error) {
        // Ignore unregistering a menu that was not registered.
      }
    }
  },

  async registerPreferencePane() {
    if (!Zotero.PreferencePanes || !Zotero.PreferencePanes.register) {
      this.log("Zotero.PreferencePanes unavailable");
      return;
    }

    this.unregisterPreferencePane();
    try {
      this._preferencePaneID = await Zotero.PreferencePanes.register({
        pluginID: ADDON_ID,
        id: "zotero-obsidian-linker-prefpane",
        src: "content/preferences.xhtml",
        label: "Obsidian Linker",
        image: "chrome://zotero/skin/20/universal/note.svg"
      });
      this.log(`registered preference pane: ${this._preferencePaneID}`);
    }
    catch (error) {
      Zotero.logError(error);
      this.log(`preference pane registration failed: ${error && error.message ? error.message : error}`);
    }
  },

  unregisterPreferencePane() {
    if (!Zotero.PreferencePanes || !Zotero.PreferencePanes.unregister) {
      return;
    }
    const paneID = this._preferencePaneID || "zotero-obsidian-linker-prefpane";
    try {
      Zotero.PreferencePanes.unregister(paneID);
    }
    catch (_error) {
      // Ignore unregistering a pane that was not registered.
    }
    this._preferencePaneID = null;
  },

  cleanupLegacyDOMMenus() {
    if (Zotero.getMainWindows) {
      for (const win of Zotero.getMainWindows()) {
        this._windows.add(win);
        this.removeFromWindow(win);
      }
      return;
    }

    const windows = Services.wm.getEnumerator("navigator:browser");
    while (windows.hasMoreElements()) {
      const win = windows.getNext();
      this._windows.add(win);
      this.removeFromWindow(win);
    }
  },

  onMainWindowLoad(win) {
    if (win) {
      this._windows.add(win);
      this.insertLocalization(win);
      this.removeFromWindow(win);
    }
  },

  onMainWindowUnload(win) {
    this.removeFromWindow(win);
    this._windows.delete(win);
  },

  removeFromWindow(win) {
    if (!win || !win.document) {
      return;
    }

    const doc = win.document;
    const itemMenu = doc.getElementById("zotero-itemmenu");
    if (itemMenu && itemMenu._obsidianLinkerPopupHandler) {
      itemMenu.removeEventListener("popupshowing", itemMenu._obsidianLinkerPopupHandler);
      delete itemMenu._obsidianLinkerPopupHandler;
    }

    for (const id of [MENU_ID, MENU_SEPARATOR_ID, TOOLS_MENU_ID, TOOLS_SEPARATOR_ID]) {
      const elem = doc.getElementById(id);
      if (elem) {
        elem.remove();
      }
    }
  },

  getMenuSourceItems(win, context = null) {
    const selectedItems = this.getSelectedPaneItems(win);
    if (selectedItems && selectedItems.length) {
      return selectedItems;
    }
    return context && context.items ? context.items : [];
  },

  getSelectedPaneItems(win) {
    const pane = win && win.ZoteroPane
      ? win.ZoteroPane
      : Zotero.getActiveZoteroPane && Zotero.getActiveZoteroPane();
    if (!pane || !pane.getSelectedItems) {
      return [];
    }
    try {
      return pane.getSelectedItems();
    }
    catch (error) {
      Zotero.logError(error);
      return [];
    }
  },

  runCreateOrUpdateFromMenu(win, selectedItems) {
    const run = () => {
      void this.createOrUpdateFromSelection(win, selectedItems);
    };
    if (win && win.setTimeout) {
      win.setTimeout(run, 0);
    }
    else {
      setTimeout(run, 0);
    }
  },

  resolveRegularItems(items) {
    const regularItems = [];
    const seen = new Set();
    for (const item of this.toItemArray(items)) {
      const regularItem = this.resolveRegularItem(item);
      if (!regularItem || seen.has(regularItem.id)) {
        continue;
      }
      seen.add(regularItem.id);
      regularItems.push(regularItem);
    }
    return regularItems;
  },

  resolveRegularItem(item) {
    if (!item) {
      return null;
    }

    if (typeof item === "number") {
      item = Zotero.Items.get(item);
    }
    if (!item) {
      return null;
    }

    if (item.isRegularItem && item.isRegularItem()) {
      return item;
    }

    if (item.topLevelItem && item.topLevelItem.isRegularItem && item.topLevelItem.isRegularItem()) {
      return item.topLevelItem;
    }

    const parentID = item.parentItemID || item.parentID;
    if (parentID) {
      const parent = Zotero.Items.get(parentID);
      if (parent && parent.isRegularItem && parent.isRegularItem()) {
        return parent;
      }
    }

    return null;
  },

  toItemArray(items) {
    if (!items) {
      return [];
    }
    if (Array.isArray(items)) {
      return items;
    }
    try {
      return Array.from(items);
    }
    catch (_error) {
      return [];
    }
  },

  async createOrUpdateFromSelection(win, selectedItems = null) {
    let items = [];
    try {
      const contextItems = this.toItemArray(selectedItems);
      const sourceItems = contextItems.length ? contextItems : this.getSelectedPaneItems(win);
      items = this.resolveRegularItems(sourceItems);
      if (!items.length) {
        this.alert(win, "请选择一个 Zotero 条目，或者这个条目下面的 PDF 附件。");
        return;
      }

      await this.writeRunMarker(`start itemIDs=${items.map(item => item.id).join(",")}`);

      const config = await this.ensureConfig(win);
      if (!config) {
        await this.writeRunMarker("cancelled no-config");
        return;
      }

      const results = [];
      for (const item of items) {
        const result = await this.createOrUpdateNoteForItem(item, config);
        results.push(result);
      }

      await this.restoreSelection(win, items);

      if (this.getPref("showSuccessAlert", false)) {
        this.alert(win, results.map(r => `${r.status}: ${r.fileName}`).join("\n"));
      }
      else {
        this.log(`completed without alert: ${results.map(r => `${r.status}:${r.fileName}`).join(", ")}`);
      }
      await this.writeRunMarker(`completed ${results.map(r => `${r.status}:${r.fileName}`).join(",")}`);
    }
    catch (error) {
      Zotero.logError(error);
      await this.writeRunMarker(`error ${error && error.message ? error.message : error}`);
      await this.restoreSelection(win, items);
      this.alert(win, `Failed to create Obsidian note:\n${error.message || error}`);
    }
  },

  async restoreSelection(win, items) {
    const itemIDs = this.resolveRegularItems(items).map(item => item.id);
    if (!itemIDs.length) {
      return;
    }

    const pane = win && win.ZoteroPane
      ? win.ZoteroPane
      : Zotero.getActiveZoteroPane && Zotero.getActiveZoteroPane();
    if (!pane || !pane.selectItems) {
      return;
    }

    await this.delay(win, 0);
    try {
      await pane.selectItems(itemIDs, {
        noTabSwitch: true,
        noWindowRestore: true
      });
    }
    catch (_error) {
      await pane.selectItems(itemIDs);
    }

    try {
      const itemTreeID = pane.itemsView && pane.itemsView.id;
      const itemTree = itemTreeID && win && win.document ? win.document.getElementById(itemTreeID) : null;
      if (itemTree && itemTree.focus) {
        itemTree.focus();
      }
    }
    catch (_error) {
      // Focus restoration is best-effort.
    }
  },

  delay(win, ms) {
    return new Promise(resolve => {
      if (win && win.setTimeout) {
        win.setTimeout(resolve, ms);
      }
      else {
        setTimeout(resolve, ms);
      }
    });
  },

  async ensureConfig(win) {
    let noteDir = this.getPref("noteDir", "");
    const fileNameTemplate = this.getPref("fileNameTemplate", DEFAULT_FILE_NAME_TEMPLATE) || DEFAULT_FILE_NAME_TEMPLATE;

    if (!noteDir) {
      noteDir = await this.pickFolder(win, "Choose Obsidian note directory");
      if (!noteDir) {
        return null;
      }
      this.setPref("noteDir", noteDir);
    }

    return { noteDir, fileNameTemplate };
  },

  async configure(win) {
    const currentDir = this.getPref("noteDir", "");
    const currentTemplate = this.getPref("fileNameTemplate", DEFAULT_FILE_NAME_TEMPLATE) || DEFAULT_FILE_NAME_TEMPLATE;

    const noteDir = await this.pickFolder(win, "Choose Obsidian note directory", currentDir);
    if (!noteDir) {
      return null;
    }

    const templateInput = { value: currentTemplate };
    const templateOK = Services.prompt.prompt(
      win,
      "Zotero Obsidian Linker",
      "Markdown filename template:",
      templateInput,
      null,
      {}
    );
    if (!templateOK || !templateInput.value.trim()) {
      return null;
    }

    this.setPref("noteDir", noteDir);
    this.setPref("fileNameTemplate", templateInput.value.trim());

    this.alert(
      win,
      `Configuration saved.\n\nDirectory: ${noteDir}\nTemplate: ${templateInput.value.trim()}`
    );

    return {
      noteDir,
      fileNameTemplate: templateInput.value.trim()
    };
  },

  async pickFolder(win, title, initialPath = "") {
    win = this.getDialogWindow(win);
    try {
      const { FilePicker } = ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs");
      const filePicker = new FilePicker();
      if (initialPath) {
        try {
          filePicker.displayDirectory = initialPath;
        }
        catch (_error) {
          // Ignore stale paths.
        }
      }
      filePicker.init(win, title, filePicker.modeGetFolder);
      filePicker.appendFilters(filePicker.filterAll);
      const result = await filePicker.show();
      if (result !== filePicker.returnOK && result !== filePicker.returnReplace) {
        return "";
      }
      return this.normalizePath(filePicker.file);
    }
    catch (error) {
      Zotero.logError(error);
      this.log(`FilePicker module failed, using nsIFilePicker fallback: ${error && error.message ? error.message : error}`);
    }

    const filePicker = Components.classes["@mozilla.org/filepicker;1"]
      .createInstance(Components.interfaces.nsIFilePicker);
    const parent = win && win.browsingContext ? win.browsingContext : win;
    filePicker.init(parent, title, Components.interfaces.nsIFilePicker.modeGetFolder);
    if (initialPath) {
      try {
        const dir = Zotero.File.pathToFile(initialPath);
        if (dir.exists() && dir.isDirectory()) {
          filePicker.displayDirectory = dir;
        }
      }
      catch (_error) {
        // Ignore stale paths.
      }
    }

    const result = await new Promise(resolve => filePicker.open(resolve));
    if (
      result !== Components.interfaces.nsIFilePicker.returnOK &&
      result !== Components.interfaces.nsIFilePicker.returnReplace
    ) {
      return "";
    }

    return this.normalizePath(filePicker.file.path);
  },

  getDialogWindow(win) {
    if (win && win.browsingContext) {
      return win;
    }
    return Services.wm.getMostRecentWindow("zotero:pref")
      || Services.wm.getMostRecentWindow("navigator:browser")
      || Services.wm.getMostRecentWindow(null);
  },

  normalizePath(path) {
    if (typeof PathUtils !== "undefined" && PathUtils.normalize) {
      return PathUtils.normalize(path);
    }
    return path;
  },

  getPref(key, fallback) {
    try {
      const value = Zotero.Prefs.get(PREF_BRANCH + key);
      return this.normalizePrefValue(value, fallback);
    }
    catch (_error) {
      return fallback;
    }
  },

  setPref(key, value) {
    Zotero.Prefs.set(PREF_BRANCH + key, value);
  },

  prefHasUserValue(key) {
    const prefName = PREF_BRANCH + key;
    try {
      if (Zotero.Prefs && Zotero.Prefs.prefHasUserValue) {
        if (Zotero.Prefs.prefHasUserValue(prefName)) {
          return true;
        }
      }
    }
    catch (_error) {
      // Fall through to Services.prefs.
    }

    try {
      if (Services.prefs.prefHasUserValue(`extensions.zotero.${prefName}`)) {
        return true;
      }
    }
    catch (_error) {
      // Fall through to false.
    }
    return false;
  },

  ensurePrefDefaults() {
    const defaults = {
      noteDir: "",
      fileNameTemplate: DEFAULT_FILE_NAME_TEMPLATE,
      showSuccessAlert: false,
      trustObsidianLinks: false,
      managedObsidianProtocolPrefs: false
    };
    for (const [key, fallback] of Object.entries(defaults)) {
      if (!this.prefHasUserValue(key)) {
        this.setPref(key, fallback);
        continue;
      }
      const value = this.getPref(key, fallback);
      if (value === fallback) {
        this.setPref(key, fallback);
      }
    }
  },

  normalizePrefValue(value, fallback) {
    if (value === undefined || value === null || value === "undefined" || value === "null") {
      return fallback;
    }
    return value;
  },

  onPrefsLoad(event) {
    const win = event.target.ownerDocument.defaultView;
    this.ensurePrefDefaults();
    const sync = () => this.syncPrefsWindow(win);
    sync();
    win.setTimeout(sync, 0);
    win.setTimeout(sync, 100);
  },

  syncPrefsWindow(win) {
    if (!win || !win.document) {
      return;
    }
    const fields = [
      ["zotero-obsidian-linker-note-dir", "noteDir", ""],
      ["zotero-obsidian-linker-file-name-template", "fileNameTemplate", DEFAULT_FILE_NAME_TEMPLATE]
    ];
    for (const [id, key, fallback] of fields) {
      const elem = win.document.getElementById(id);
      if (elem) {
        elem.value = this.getPref(key, fallback);
      }
    }
  },

  async chooseNoteDirFromPrefs(win) {
    try {
      await this.writePreferenceMarker("choose-start");
      const noteDir = await this.pickFolder(win, "Choose Obsidian note directory", this.getPref("noteDir", ""));
      await this.writePreferenceMarker(`choose-result=${noteDir || "cancel"}`);
      if (!noteDir) {
        return;
      }
      this.setPref("noteDir", noteDir);
      this.syncPrefsWindow(win);
    }
    catch (error) {
      Zotero.logError(error);
      await this.writePreferenceMarker(`choose-error=${error && error.message ? error.message : error}`);
      this.alert(win, `Failed to choose Obsidian note directory:\n${error.message || error}`);
    }
  },

  onTrustObsidianLinksChanged(win) {
    win.setTimeout(() => this.applyTrustObsidianLinksPref(), 0);
  },

  applyTrustObsidianLinksPref() {
    const prefs = Services.prefs;
    if (!this.getPref("trustObsidianLinks", false)) {
      if (this.getPref("managedObsidianProtocolPrefs", false)) {
        for (const pref of [
          "network.protocol-handler.external.obsidian",
          "network.protocol-handler.warn-external.obsidian",
          "network.protocol-handler.expose.obsidian"
        ]) {
          if (prefs.prefHasUserValue(pref)) {
            prefs.clearUserPref(pref);
          }
        }
        this.setPref("managedObsidianProtocolPrefs", false);
        this.log("cleared managed obsidian:// protocol preferences");
      }
      return;
    }

    prefs.setBoolPref("network.protocol-handler.external.obsidian", true);
    prefs.setBoolPref("network.protocol-handler.warn-external.obsidian", false);
    prefs.setBoolPref("network.protocol-handler.expose.obsidian", false);
    this.setPref("managedObsidianProtocolPrefs", true);
    this.log("trusted obsidian:// external protocol links");
  },

  async createOrUpdateNoteForItem(item, config) {
    const metadata = await this.getMetadata(item, config);
    const fileName = this.renderFileName(config.fileNameTemplate, metadata);
    const notePath = this.joinPath(config.noteDir, fileName);

    metadata.notePath = notePath;
    metadata.obsidianURI = this.buildObsidianURI(notePath);

    const file = Zotero.File.pathToFile(notePath);
    const exists = file.exists();
    const oldContent = exists ? await Zotero.File.getContentsAsync(file) : "";
    const nextContent = this.updateMarkdown(oldContent, metadata, exists);

    await Zotero.File.putContentsAsync(notePath, nextContent);
    await this.ensureZoteroAttachment(item, metadata.obsidianURI);

    return { status: exists ? "updated" : "created", fileName };
  },

  async getMetadata(item, config) {
    const title = item.getField("title") || "Untitled";
    const date = item.getField("date") || "";
    const year = this.extractYear(date);
    const creators = item.getCreatorsJSON ? item.getCreatorsJSON() : [];
    const authors = creators
      .filter(creator => creator.creatorType === "author")
      .map(creator => creator.name || [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim())
      .filter(Boolean);
    const firstAuthor = authors[0] ? authors[0].split(/\s+/).slice(-1)[0] : "";
    const citationKey = this.getCitationKey(item);
    const pdf = await this.getPDFAttachment(item);
    const scope = this.getZoteroScope(item);

    const itemURI = `zotero://select/${scope}/items/${item.key}`;
    const pdfURI = pdf ? `zotero://open-pdf/${scope}/items/${pdf.key}` : "";

    return {
      title,
      authors,
      firstAuthor,
      year,
      date,
      doi: item.getField("DOI") || "",
      url: item.getField("url") || "",
      citationKey,
      itemKey: item.key,
      itemURI,
      pdfKey: pdf ? pdf.key : "",
      pdfURI
    };
  },

  getCitationKey(item) {
    const nativeKey = item.getField("citationKey");
    if (nativeKey) {
      return nativeKey;
    }

    const extra = item.getField("extra") || "";
    const match = extra.match(/(?:Citation Key|citation key|BibTeX key|tex\.ids)\s*[:=]\s*([^\s]+)/i);
    return match ? match[1].trim() : "";
  },

  async getPDFAttachment(item) {
    const attachments = Zotero.Items.get(item.getAttachments(false));
    const pdf = attachments.find(att => att.isPDFAttachment && att.isPDFAttachment());
    if (pdf) {
      return pdf;
    }

    const best = await item.getBestAttachment();
    return best && best.isPDFAttachment && best.isPDFAttachment() ? best : null;
  },

  getZoteroScope(item) {
    try {
      const library = Zotero.Libraries.get(item.libraryID);
      if (library && library.libraryType === "group" && library.groupID) {
        return `groups/${library.groupID}`;
      }
    }
    catch (_error) {
      // Fall through to personal library URI.
    }
    return "library";
  },

  renderFileName(template, metadata) {
    const values = {
      citekey: metadata.citationKey || metadata.itemKey,
      title: metadata.title,
      year: metadata.year,
      firstAuthor: metadata.firstAuthor,
      itemKey: metadata.itemKey
    };

    let fileName = template.replace(/\{\{\s*(citekey|title|year|firstAuthor|itemKey)\s*\}\}/g, (_match, key) => {
      return values[key] || "";
    });

    fileName = this.sanitizeFileName(fileName || `${metadata.itemKey}.md`);
    if (!fileName.toLowerCase().endsWith(".md")) {
      fileName += ".md";
    }
    return fileName;
  },

  sanitizeFileName(fileName) {
    return fileName
      .replace(/[\\\\/:*?"<>|]/g, " ")
      .replace(/[\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  updateMarkdown(oldContent, metadata, exists) {
    const frontmatter = this.buildFrontmatter(metadata);
    const linkBlock = this.buildLinkBlock(metadata);

    if (!exists || !oldContent.trim()) {
      return `${frontmatter}\n\n# ${metadata.title}\n\n${linkBlock}\n\n## Notes\n\n`;
    }

    let body = oldContent;
    if (body.startsWith("---\n")) {
      const end = body.indexOf("\n---", 4);
      if (end !== -1) {
        body = body.slice(end + 5).replace(/^\n+/, "");
      }
    }

    body = this.upsertLinkBlock(body, linkBlock);
    return `${frontmatter}\n\n${body}`;
  },

  buildFrontmatter(metadata) {
    const authors = metadata.authors.length
      ? metadata.authors.map(author => `  - ${this.yamlString(author)}`).join("\n")
      : "  []";

    return [
      "---",
      `citekey: ${this.yamlString(metadata.citationKey)}`,
      `title: ${this.yamlString(metadata.title)}`,
      "authors:",
      authors,
      `year: ${this.yamlString(metadata.year)}`,
      `doi: ${this.yamlString(metadata.doi)}`,
      `url: ${this.yamlString(metadata.url)}`,
      `zotero_item: ${this.yamlString(metadata.itemURI)}`,
      `zotero_item_key: ${this.yamlString(metadata.itemKey)}`,
      `zotero_pdf: ${this.yamlString(metadata.pdfURI)}`,
      `zotero_pdf_key: ${this.yamlString(metadata.pdfKey)}`,
      `obsidian_uri: ${this.yamlString(metadata.obsidianURI)}`,
      "---"
    ].join("\n");
  },

  buildLinkBlock(metadata) {
    const links = [`[Zotero 条目](${metadata.itemURI})`];
    if (metadata.pdfURI) {
      links.push(`[原文 PDF](${metadata.pdfURI})`);
    }

    return `${LINK_BLOCK_START}\n${links.join(" | ")}\n${LINK_BLOCK_END}`;
  },

  upsertLinkBlock(body, linkBlock) {
    const start = body.indexOf(LINK_BLOCK_START);
    const end = body.indexOf(LINK_BLOCK_END);
    if (start !== -1 && end !== -1 && end > start) {
      return `${body.slice(0, start)}${linkBlock}${body.slice(end + LINK_BLOCK_END.length)}`;
    }

    return `${linkBlock}\n\n${body.replace(/^\n+/, "")}`;
  },

  async ensureZoteroAttachment(item, obsidianURI) {
    const attachments = Zotero.Items.get(item.getAttachments(false));
    const existing = attachments.find(att =>
      att.isAttachment()
      && att.attachmentLinkMode === Zotero.Attachments.LINK_MODE_LINKED_URL
      && att.getField("url") === obsidianURI
    );

    if (existing) {
      return existing;
    }

    return Zotero.Attachments.linkFromURL({
      url: obsidianURI,
      parentItemID: item.id,
      title: "Obsidian Note",
      saveOptions: {
        skipSelect: true
      }
    });
  },

  buildObsidianURI(notePath) {
    return `obsidian://open?path=${encodeURIComponent(notePath)}`;
  },

  joinPath(dir, fileName) {
    const separator = Zotero.isWin ? "\\" : "/";
    return `${dir.replace(/[\\/]+$/, "")}${separator}${fileName}`;
  },

  extractYear(date) {
    const match = String(date || "").match(/\b(\d{4})\b/);
    return match ? match[1] : "";
  },

  yamlString(value) {
    if (value === undefined || value === null || value === "") {
      return "''";
    }
    return `'${String(value).replace(/'/g, "''")}'`;
  },

  alert(win, message) {
    Services.prompt.alert(win, "Zotero Obsidian Linker", message);
  },

  log(message) {
    if (Zotero && Zotero.debug) {
      Zotero.debug(`[Zotero Obsidian Linker] ${message}`);
    }
  },

  async writeStartupMarker(event) {
    try {
      const windows = Zotero.getMainWindows ? Zotero.getMainWindows().length : "unknown";
      const text = [
        `event=${event}`,
        `time=${new Date().toISOString()}`,
        `version=${PLUGIN_VERSION}`,
        `mainWindows=${windows}`,
        `hasMenuManager=${!!Zotero.MenuManager}`,
        `hasPreferencePanes=${!!Zotero.PreferencePanes}`,
        `preferencePaneID=${this._preferencePaneID || ""}`,
        `attachedWindows=${this._windows.size}`,
        `showSuccessAlert=${this.getPref("showSuccessAlert", false)}`,
        `trustObsidianLinks=${this.getPref("trustObsidianLinks", false)}`
      ].join("\n") + "\n";
      await Zotero.File.putContentsAsync("/tmp/zotero-obsidian-linker-startup.log", text);
    }
    catch (error) {
      Zotero.logError(error);
    }
  },

  async writePreferenceMarker(message) {
    try {
      const text = [
        `time=${new Date().toISOString()}`,
        `version=${PLUGIN_VERSION}`,
        String(message)
      ].join("\n") + "\n";
      await Zotero.File.putContentsAsync("/tmp/zotero-obsidian-linker-prefs.log", text);
    }
    catch (error) {
      Zotero.logError(error);
    }
  },

  async writeRunMarker(message) {
    try {
      const path = "/tmp/zotero-obsidian-linker-run.log";
      let previous = "";
      try {
        const file = Zotero.File.pathToFile(path);
        if (file.exists()) {
          previous = await Zotero.File.getContentsAsync(file);
        }
      }
      catch (_error) {
        previous = "";
      }

      const line = [
        new Date().toISOString(),
        `version=${PLUGIN_VERSION}`,
        String(message)
      ].join(" ") + "\n";
      const lines = `${previous}${line}`.split("\n").filter(Boolean).slice(-200);
      await Zotero.File.putContentsAsync(path, lines.join("\n") + "\n");
    }
    catch (error) {
      Zotero.logError(error);
    }
  }
};

async function startup(data, reason) {
  await ObsidianLinker.startup(data, reason);
}

function onMainWindowLoad({ window }) {
  ObsidianLinker.onMainWindowLoad(window);
}

function onMainWindowUnload({ window }) {
  ObsidianLinker.onMainWindowUnload(window);
}

function shutdown(data, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }
  ObsidianLinker.shutdown(data, reason);
}

function install() {}

function uninstall() {}
