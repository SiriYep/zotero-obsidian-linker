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
const DEFAULT_FILE_NAME_TEMPLATE = "{{paperDate}}-{{shortTitle3}}-{{firstAuthor}}.md";
const LEGACY_DEFAULT_FILE_NAME_TEMPLATES = new Set([
  "{{citekey}}",
  "{{citekey}}.md",
  "{{noteDate}}-{{shortTitle3}}-{{firstAuthor}}.md"
]);
const MONTH_NAMES = new Map([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12]
]);
const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "based",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "through",
  "to",
  "toward",
  "towards",
  "using",
  "via",
  "with"
]);
const TITLE_CONNECTOR_WORDS = new Set(["and", "in", "of", "on", "or", "to"]);
const PLUGIN_VERSION = "0.2.7";

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
    const value = typeof path === "string"
      ? path
      : path && path.path
        ? path.path
        : String(path || "");
    if (typeof PathUtils !== "undefined" && PathUtils.normalize) {
      try {
        return PathUtils.normalize(value);
      }
      catch (_error) {
        // PathUtils.normalize() can throw for paths that do not exist yet.
      }
    }
    return value.replace(/[\\/]+/g, Zotero.isWin ? "\\" : "/");
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
      const hasUserValue = this.prefHasUserValue(key);
      if (!hasUserValue) {
        this.setPref(key, fallback);
        continue;
      }
      const value = this.getPref(key, fallback);
      if (value === fallback) {
        this.setPref(key, fallback);
      }
    }

    const template = String(this.getPref("fileNameTemplate", DEFAULT_FILE_NAME_TEMPLATE) || "").trim();
    if (LEGACY_DEFAULT_FILE_NAME_TEMPLATES.has(template)) {
      this.setPref("fileNameTemplate", DEFAULT_FILE_NAME_TEMPLATE);
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

  async normalizeNoteFileNamesFromPrefs(win) {
    try {
      this.ensurePrefDefaults();
      const noteDirInput = win && win.document
        ? win.document.getElementById("zotero-obsidian-linker-note-dir")
        : null;
      const templateInput = win && win.document
        ? win.document.getElementById("zotero-obsidian-linker-file-name-template")
        : null;
      const noteDir = noteDirInput && noteDirInput.value
        ? noteDirInput.value
        : this.getPref("noteDir", "");
      const fileNameTemplate = templateInput && templateInput.value && templateInput.value.trim()
        ? templateInput.value.trim()
        : this.getPref("fileNameTemplate", DEFAULT_FILE_NAME_TEMPLATE) || DEFAULT_FILE_NAME_TEMPLATE;
      if (!noteDir) {
        this.alert(win, "请先选择 Obsidian note directory。");
        return;
      }
      this.setPref("fileNameTemplate", fileNameTemplate);

      const confirmed = Services.prompt.confirm(
        win,
        "Zotero Obsidian Linker",
        "Scan the note directory and rename plugin-managed Markdown notes using the current filename template?"
      );
      if (!confirmed) {
        return;
      }

      const result = await this.normalizeNoteFileNames(noteDir, fileNameTemplate);
      this.alert(
        win,
        [
          `Scanned: ${result.scanned}`,
          `Managed notes: ${result.managed}`,
          `Renamed: ${result.renamed}`,
          `Updated: ${result.updated}`,
          `Unchanged: ${result.unchanged}`,
          `Skipped: ${result.skipped}`,
          `Conflicts avoided: ${result.conflicts}`,
          `Errors: ${result.errors}`,
          "",
          "Details were written to /tmp/zotero-obsidian-linker-batch-rename.log"
        ].join("\n")
      );
    }
    catch (error) {
      Zotero.logError(error);
      this.alert(win, `Failed to normalize filenames:\n${error.message || error}`);
    }
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
    const existingNotePath = await this.findExistingNotePath(item, config.noteDir);
    metadata.noteDate = await this.resolveNoteDate(existingNotePath);
    const fileName = this.renderFileName(config.fileNameTemplate, metadata);
    const notePath = this.joinPath(config.noteDir, fileName);

    metadata.notePath = notePath;
    metadata.obsidianURI = this.buildObsidianURI(notePath);

    const file = Zotero.File.pathToFile(notePath);
    const exists = file.exists();
    const sourcePath = existingNotePath && !this.pathsEqual(existingNotePath, notePath)
      ? existingNotePath
      : notePath;
    const sourceFile = Zotero.File.pathToFile(sourcePath);
    const sourceExists = sourceFile.exists();
    const oldContent = exists
      ? await Zotero.File.getContentsAsync(file)
      : sourceExists
        ? await Zotero.File.getContentsAsync(sourceFile)
        : "";
    const nextContent = this.updateMarkdown(oldContent, metadata);

    await Zotero.File.putContentsAsync(notePath, nextContent);
    if (!exists && sourceExists && !this.pathsEqual(sourcePath, notePath)) {
      await this.removeFile(sourcePath);
    }
    await this.ensureZoteroAttachment(item, metadata.obsidianURI);

    return { status: exists ? "updated" : sourceExists ? "renamed" : "created", fileName };
  },

  async getMetadata(item, config) {
    const title = item.getField("title") || "Untitled";
    const date = item.getField("date") || "";
    const year = this.extractYear(date);
    const paperDate = this.formatPaperDate(date);
    const creators = item.getCreatorsJSON ? item.getCreatorsJSON() : [];
    const authors = creators
      .filter(creator => creator.creatorType === "author")
      .map(creator => creator.name || [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim())
      .filter(Boolean);
    const firstAuthor = authors[0] ? authors[0].split(/\s+/).slice(-1)[0] : "";
    const shortTitle3 = this.buildShortTitle(title, 3);
    const citationKey = this.getCitationKey(item);
    const pdf = await this.getPDFAttachment(item);
    const scope = this.getZoteroScope(item);

    const itemURI = `zotero://select/${scope}/items/${item.key}`;
    const pdfURI = pdf ? `zotero://open-pdf/${scope}/items/${pdf.key}` : "";

    return {
      title,
      authors,
      firstAuthor,
      shortTitle3,
      year,
      date,
      paperDate,
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

  async normalizeNoteFileNames(noteDir, fileNameTemplate) {
    const paths = this.getMarkdownFiles(noteDir);
    const result = {
      scanned: paths.length,
      managed: 0,
      renamed: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      conflicts: 0,
      errors: 0,
      details: []
    };
    const occupied = new Set(paths.map(path => this.pathSetKey(path)));

    for (const path of paths) {
      try {
        const file = Zotero.File.pathToFile(path);
        const content = await Zotero.File.getContentsAsync(file);
        const note = this.parsePluginNote(content);
        if (!note) {
          result.skipped++;
          continue;
        }

        result.managed++;
        const item = await this.resolveItemFromNote(note);
        if (!item) {
          result.skipped++;
          result.details.push(`skipped unresolved item: ${path}`);
          continue;
        }

        const metadata = await this.getMetadata(item, { noteDir, fileNameTemplate });
        metadata.noteDate = note.noteDate || await this.resolveNoteDate(path);
        if (metadata.paperDate === "000000" && note.paperDate) {
          metadata.paperDate = note.paperDate;
        }

        const targetDir = this.parentDir(path);
        const desiredPath = this.joinPath(targetDir, this.renderFileName(fileNameTemplate, metadata));
        const target = this.resolveRenameTarget(path, desiredPath, metadata, occupied);
        if (target.conflict) {
          result.conflicts++;
        }

        metadata.notePath = target.path;
        metadata.obsidianURI = this.buildObsidianURI(target.path);
        const nextContent = this.updateMarkdown(content, metadata);
        await Zotero.File.putContentsAsync(target.path, nextContent);
        await this.ensureZoteroAttachment(item, metadata.obsidianURI);

        if (!this.pathsEqual(path, target.path)) {
          await this.removeFile(path);
          occupied.delete(this.pathSetKey(path));
          occupied.add(this.pathSetKey(target.path));
          result.renamed++;
          result.details.push(`renamed: ${path} -> ${target.path}`);
        }
        else if (nextContent !== content) {
          result.updated++;
          result.details.push(`updated: ${path}`);
        }
        else {
          result.unchanged++;
        }
      }
      catch (error) {
        Zotero.logError(error);
        result.errors++;
        result.details.push(`error: ${path}: ${error && error.message ? error.message : error}`);
      }
    }

    await this.writeBatchRenameMarker(result);
    return result;
  },

  getMarkdownFiles(noteDir) {
    const root = Zotero.File.pathToFile(noteDir);
    const paths = [];
    if (!root.exists() || !root.isDirectory()) {
      throw new Error(`Note directory does not exist: ${noteDir}`);
    }

    this.collectMarkdownFiles(root, paths);
    return paths.sort((left, right) => left.localeCompare(right));
  },

  collectMarkdownFiles(dir, paths) {
    const entries = dir.directoryEntries;
    try {
      while (entries.hasMoreElements()) {
        const entry = entries.getNext().QueryInterface(Components.interfaces.nsIFile);
        if (entry.isDirectory()) {
          this.collectMarkdownFiles(entry, paths);
          continue;
        }
        if (entry.isFile() && /\.md$/i.test(entry.leafName)) {
          paths.push(entry.path);
        }
      }
    }
    finally {
      if (entries.close) {
        entries.close();
      }
    }
  },

  parsePluginNote(content) {
    const block = this.getFrontmatterBlock(content);
    if (!block) {
      return null;
    }

    const frontmatter = block.frontmatter;
    const itemKey = this.getFrontmatterScalar(frontmatter, "zotero_item_key");
    const itemURI = this.getFrontmatterScalar(frontmatter, "zotero_item");
    const obsidianURI = this.getFrontmatterScalar(frontmatter, "obsidian_uri");
    const hasManagedMarker = content.includes(LINK_BLOCK_START) || content.includes(LINK_BLOCK_END);
    if (!itemKey || (!obsidianURI && !hasManagedMarker)) {
      return null;
    }

    return {
      citationKey: this.getFrontmatterScalar(frontmatter, "citekey"),
      title: this.getFrontmatterScalar(frontmatter, "title"),
      authors: this.getFrontmatterList(frontmatter, "authors"),
      year: this.getFrontmatterScalar(frontmatter, "year"),
      paperDate: this.getFrontmatterScalar(frontmatter, "paper_date"),
      noteDate: this.getFrontmatterScalar(frontmatter, "note_date"),
      doi: this.getFrontmatterScalar(frontmatter, "doi"),
      url: this.getFrontmatterScalar(frontmatter, "url"),
      itemURI,
      itemKey,
      pdfURI: this.getFrontmatterScalar(frontmatter, "zotero_pdf"),
      pdfKey: this.getFrontmatterScalar(frontmatter, "zotero_pdf_key"),
      obsidianURI
    };
  },

  getFrontmatterBlock(content) {
    if (!content || !content.startsWith("---\n")) {
      return null;
    }
    const end = content.indexOf("\n---", 4);
    if (end === -1) {
      return null;
    }
    return {
      frontmatter: content.slice(4, end),
      body: content.slice(end + 5)
    };
  },

  getFrontmatterScalar(frontmatter, key) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = String(frontmatter || "").match(new RegExp(`^${escapedKey}:\\s*(.*?)\\s*$`, "m"));
    return match ? this.decodeYAMLScalar(match[1]) : "";
  },

  getFrontmatterList(frontmatter, key) {
    const lines = String(frontmatter || "").split(/\r?\n/);
    const values = [];
    for (let i = 0; i < lines.length; i++) {
      if (!new RegExp(`^${key}:\\s*$`).test(lines[i])) {
        continue;
      }
      for (let j = i + 1; j < lines.length; j++) {
        const match = lines[j].match(/^\s+-\s+(.*?)\s*$/);
        if (!match) {
          break;
        }
        values.push(this.decodeYAMLScalar(match[1]));
      }
      break;
    }
    return values.filter(Boolean);
  },

  decodeYAMLScalar(value) {
    const text = String(value || "").trim();
    if (text === "''" || text === '""') {
      return "";
    }
    if (text.startsWith("'") && text.endsWith("'")) {
      return text.slice(1, -1).replace(/''/g, "'");
    }
    if (text.startsWith('"') && text.endsWith('"')) {
      try {
        return JSON.parse(text);
      }
      catch (_error) {
        return text.slice(1, -1);
      }
    }
    return text;
  },

  async resolveItemFromNote(note) {
    const parsed = this.parseZoteroItemURI(note.itemURI);
    if (parsed && parsed.libraryID && parsed.key) {
      const item = await this.getItemByLibraryAndKey(parsed.libraryID, parsed.key);
      if (item) {
        return item;
      }
    }

    if (!note.itemKey) {
      return null;
    }

    const userLibraryID = Zotero.Libraries && Zotero.Libraries.userLibraryID;
    if (userLibraryID) {
      const item = await this.getItemByLibraryAndKey(userLibraryID, note.itemKey);
      if (item) {
        return item;
      }
    }

    for (const libraryID of this.getAllLibraryIDs()) {
      const item = await this.getItemByLibraryAndKey(libraryID, note.itemKey);
      if (item) {
        return item;
      }
    }

    return null;
  },

  parseZoteroItemURI(uri) {
    const text = String(uri || "");
    let match = text.match(/^zotero:\/\/select\/library\/items\/([A-Z0-9]+)$/i);
    if (match) {
      return {
        libraryID: Zotero.Libraries.userLibraryID,
        key: match[1]
      };
    }

    match = text.match(/^zotero:\/\/select\/groups\/(\d+)\/items\/([A-Z0-9]+)$/i);
    if (match) {
      try {
        const group = Zotero.Groups.get(Number(match[1]));
        return group && group.libraryID
          ? { libraryID: group.libraryID, key: match[2] }
          : null;
      }
      catch (_error) {
        return null;
      }
    }

    return null;
  },

  async getItemByLibraryAndKey(libraryID, key) {
    if (!libraryID || !key) {
      return null;
    }

    let item = null;
    if (Zotero.Items.getByLibraryAndKeyAsync) {
      item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
    }
    else if (Zotero.Items.getByLibraryAndKey) {
      item = Zotero.Items.getByLibraryAndKey(libraryID, key);
    }

    return item && item.isRegularItem && item.isRegularItem() ? item : null;
  },

  getAllLibraryIDs() {
    try {
      if (Zotero.Libraries.getAll) {
        return Zotero.Libraries.getAll()
          .map(library => typeof library === "number" ? library : library.libraryID)
          .filter(Boolean);
      }
    }
    catch (_error) {
      // Fall through to user library only.
    }

    return Zotero.Libraries.userLibraryID ? [Zotero.Libraries.userLibraryID] : [];
  },

  resolveRenameTarget(currentPath, desiredPath, metadata, occupied) {
    if (this.pathsEqual(currentPath, desiredPath)) {
      return { path: desiredPath, conflict: false };
    }

    const desiredKey = this.pathSetKey(desiredPath);
    const desiredFile = Zotero.File.pathToFile(desiredPath);
    if (!occupied.has(desiredKey) && !desiredFile.exists()) {
      return { path: desiredPath, conflict: false };
    }

    const dir = this.parentDir(desiredPath);
    const base = this.fileBaseName(desiredPath);
    const suffix = metadata.itemKey || metadata.citationKey || "note";
    const fallback = this.joinPath(dir, this.sanitizeFileName(`${base}-${suffix}.md`));
    const fallbackKey = this.pathSetKey(fallback);
    const fallbackFile = Zotero.File.pathToFile(fallback);
    if (!occupied.has(fallbackKey) && !fallbackFile.exists()) {
      return { path: fallback, conflict: true };
    }

    for (let i = 2; i < 100; i++) {
      const candidate = this.joinPath(dir, this.sanitizeFileName(`${base}-${suffix}-${i}.md`));
      const candidateKey = this.pathSetKey(candidate);
      const candidateFile = Zotero.File.pathToFile(candidate);
      if (!occupied.has(candidateKey) && !candidateFile.exists()) {
        return { path: candidate, conflict: true };
      }
    }

    throw new Error(`Could not find available filename for ${desiredPath}`);
  },

  async findExistingNotePath(item, noteDir) {
    const attachments = Zotero.Items.get(item.getAttachments(false));
    for (const attachment of attachments) {
      if (
        !attachment.isAttachment()
        || attachment.attachmentLinkMode !== Zotero.Attachments.LINK_MODE_LINKED_URL
      ) {
        continue;
      }

      const path = this.extractObsidianPath(attachment.getField("url"), noteDir);
      if (!path || !this.isPathInsideDir(path, noteDir)) {
        continue;
      }

      try {
        const file = Zotero.File.pathToFile(path);
        if (file.exists()) {
          return path;
        }
      }
      catch (_error) {
        // Ignore stale or malformed paths.
      }
    }
    return "";
  },

  extractObsidianPath(uri, noteDir) {
    if (!uri || !String(uri).startsWith("obsidian://open?")) {
      return "";
    }

    const query = String(uri).split("?").slice(1).join("?");
    const params = this.parseQueryString(query);
    if (params.path) {
      return params.path;
    }

    if (params.file) {
      const fileName = params.file.split(/[\\/]/).filter(Boolean).pop();
      return fileName ? this.joinPath(noteDir, fileName) : "";
    }

    return "";
  },

  parseQueryString(query) {
    const params = {};
    for (const part of String(query || "").split("&")) {
      if (!part) {
        continue;
      }
      const index = part.indexOf("=");
      const rawKey = index === -1 ? part : part.slice(0, index);
      const rawValue = index === -1 ? "" : part.slice(index + 1);
      try {
        params[decodeURIComponent(rawKey.replace(/\+/g, " "))] = decodeURIComponent(rawValue.replace(/\+/g, " "));
      }
      catch (_error) {
        // Ignore malformed query pieces.
      }
    }
    return params;
  },

  async resolveNoteDate(existingNotePath) {
    const pathDate = this.extractNoteDateFromPath(existingNotePath);
    if (pathDate) {
      return pathDate;
    }

    if (existingNotePath) {
      try {
        const file = Zotero.File.pathToFile(existingNotePath);
        if (file.exists()) {
          const content = await Zotero.File.getContentsAsync(file);
          const frontmatterDate = this.extractFrontmatterValue(content, "note_date");
          if (/^\d{6}$/.test(frontmatterDate)) {
            return frontmatterDate;
          }
        }
      }
      catch (_error) {
        // Fall back to today's date.
      }
    }

    return this.formatNoteDate(new Date());
  },

  extractNoteDateFromPath(path) {
    const fileName = String(path || "").split(/[\\/]/).pop() || "";
    const match = fileName.match(/^(\d{6})-/);
    return match ? match[1] : "";
  },

  extractFrontmatterValue(content, key) {
    if (!content || !content.startsWith("---\n")) {
      return "";
    }
    const end = content.indexOf("\n---", 4);
    if (end === -1) {
      return "";
    }
    const frontmatter = content.slice(4, end);
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = frontmatter.match(new RegExp(`^${escapedKey}:\\s*['"]?([^'"\n]+)['"]?\\s*$`, "m"));
    return match ? match[1].trim() : "";
  },

  formatNoteDate(date) {
    const year = String(date.getFullYear() % 100).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  },

  formatPaperDate(date) {
    const text = String(date || "").trim();
    const yearMatch = text.match(/\b(\d{4})\b/);
    if (!yearMatch) {
      return "000000";
    }

    const year = Number(yearMatch[1]);
    let month = 0;
    let day = 0;

    const isoMatch = text.match(/\b(\d{4})(?:[-/.](\d{1,2})(?:[-/.](\d{1,2}))?)?\b/);
    if (isoMatch && isoMatch[1] === yearMatch[1]) {
      month = this.normalizeDatePart(isoMatch[2], 12);
      day = month ? this.normalizeDatePart(isoMatch[3], 31) : 0;
    }

    if (!month) {
      const monthInfo = this.extractNamedMonthDate(text);
      month = monthInfo.month;
      day = monthInfo.day;
    }

    const shortYear = String(year % 100).padStart(2, "0");
    return `${shortYear}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  },

  normalizeDatePart(value, max) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > max) {
      return 0;
    }
    return number;
  },

  extractNamedMonthDate(text) {
    const tokens = String(text || "").match(/[A-Za-z]+|\d{1,4}/g) || [];
    for (let i = 0; i < tokens.length; i++) {
      const month = MONTH_NAMES.get(tokens[i].toLowerCase());
      if (!month) {
        continue;
      }

      const previous = this.normalizeDatePart(tokens[i - 1], 31);
      const next = this.normalizeDatePart(tokens[i + 1], 31);
      const day = previous || next;
      return { month, day };
    }
    return { month: 0, day: 0 };
  },

  buildShortTitle(title, count) {
    const keywords = this.extractTitleKeywords(title).slice(0, count);
    return keywords.map(keyword => this.formatTitleKeyword(keyword)).join("");
  },

  extractTitleKeywords(title) {
    return (String(title || "").match(/[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*/g) || [])
      .filter(word => !TITLE_STOP_WORDS.has(word.toLowerCase()))
      .filter(word => /[A-Za-z0-9]/.test(word));
  },

  formatTitleKeyword(keyword) {
    return String(keyword || "")
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((part, index) => this.formatTitleKeywordPart(part, index))
      .join("");
  },

  formatTitleKeywordPart(part, index) {
    const lower = part.toLowerCase();
    if (index > 0 && TITLE_CONNECTOR_WORDS.has(lower)) {
      return lower;
    }
    if (/^[A-Z0-9]+$/.test(part) || /[A-Z]/.test(part.slice(1))) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    }
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  },

  renderFileName(template, metadata) {
    const values = {
      citekey: metadata.citationKey || metadata.itemKey,
      noteDate: metadata.noteDate,
      paperDate: metadata.paperDate,
      shortTitle3: metadata.shortTitle3,
      title: metadata.title,
      year: metadata.year,
      firstAuthor: metadata.firstAuthor,
      itemKey: metadata.itemKey
    };

    let fileName = template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] || "" : match;
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

  updateMarkdown(oldContent, metadata) {
    const frontmatter = this.buildFrontmatter(metadata);
    const linkBlock = this.buildLinkBlock(metadata);

    if (!oldContent.trim()) {
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
      `paper_date: ${this.yamlString(metadata.paperDate)}`,
      `note_date: ${this.yamlString(metadata.noteDate)}`,
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

    const managed = attachments.find(att =>
      att.isAttachment()
      && att.attachmentLinkMode === Zotero.Attachments.LINK_MODE_LINKED_URL
      && (
        att.getField("title") === "Obsidian Note"
        || String(att.getField("url") || "").startsWith("obsidian://open?")
      )
    );

    if (managed) {
      managed.setField("url", obsidianURI);
      managed.setField("title", "Obsidian Note");
      await managed.saveTx({
        skipSelect: true
      });
      return managed;
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

  parentDir(path) {
    if (typeof PathUtils !== "undefined" && PathUtils.parent) {
      return PathUtils.parent(path);
    }
    return String(path || "").replace(/[\\/][^\\/]*$/, "");
  },

  fileBaseName(path) {
    const fileName = String(path || "").split(/[\\/]/).pop() || "";
    return fileName.replace(/\.md$/i, "");
  },

  pathSetKey(path) {
    const key = this.canonicalPath(path);
    return Zotero.isWin ? key.toLowerCase() : key;
  },

  pathsEqual(left, right) {
    const normalizedLeft = this.canonicalPath(left);
    const normalizedRight = this.canonicalPath(right);
    return Zotero.isWin
      ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
      : normalizedLeft === normalizedRight;
  },

  isPathInsideDir(path, dir) {
    const normalizedPath = this.canonicalPath(path);
    const normalizedDir = this.canonicalPath(dir);
    if (!normalizedPath || !normalizedDir) {
      return false;
    }
    const pathForCompare = Zotero.isWin ? normalizedPath.toLowerCase() : normalizedPath;
    const dirForCompare = Zotero.isWin ? normalizedDir.toLowerCase() : normalizedDir;
    return this.pathsEqual(normalizedPath, normalizedDir)
      || pathForCompare.startsWith(`${dirForCompare}/`);
  },

  canonicalPath(path) {
    return this.normalizePath(String(path || ""))
      .replace(/\\/g, "/")
      .replace(/\/+$/g, "");
  },

  async removeFile(path) {
    try {
      const file = Zotero.File.pathToFile(path);
      if (file.exists()) {
        file.remove(false);
      }
    }
    catch (error) {
      Zotero.logError(error);
      this.log(`failed to remove old note file: ${error && error.message ? error.message : error}`);
    }
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

  async writeBatchRenameMarker(result) {
    try {
      const text = [
        `time=${new Date().toISOString()}`,
        `version=${PLUGIN_VERSION}`,
        `scanned=${result.scanned}`,
        `managed=${result.managed}`,
        `renamed=${result.renamed}`,
        `updated=${result.updated}`,
        `unchanged=${result.unchanged}`,
        `skipped=${result.skipped}`,
        `conflicts=${result.conflicts}`,
        `errors=${result.errors}`,
        "",
        ...result.details
      ].join("\n") + "\n";
      await Zotero.File.putContentsAsync("/tmp/zotero-obsidian-linker-batch-rename.log", text);
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
