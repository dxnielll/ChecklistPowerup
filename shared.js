(function () {
  const CONFIG_DEFAULTS = {
    appName: "Checklist Companion",
    appAuthor: "Your Workspace",
    appKey: ""
  };

  const BOARD_DEFAULTS = {
    showChecklistHeaders: true,
    showFinishedContent: false,
    showProgressBar: true,
    progressFormat: "percent",
    itemOrder: "incomplete-first"
  };

  const MEMBER_DEFAULTS = {
    usePrivateBoardSettings: false,
    privateBoardSettings: BOARD_DEFAULTS
  };

  const PROGRESS_FORMATS = ["count", "percent"];
  const ITEM_ORDERS = ["incomplete-first", "original"];
  const BADGE_ROW_PADDING = "\u2007".repeat(120);

  function getConfig() {
    return Object.assign({}, CONFIG_DEFAULTS, window.CHECKLIST_POWER_UP_CONFIG || {});
  }

  function hasApiKey() {
    return Boolean(String(getConfig().appKey || "").trim());
  }

  function getInitOptions() {
    const config = getConfig();

    if (!String(config.appKey || "").trim()) {
      return null;
    }

    return {
      appKey: config.appKey,
      appName: config.appName,
      appAuthor: config.appAuthor
    };
  }

  function normalizeBoardPrefs(raw, fallback) {
    const prefs = raw || {};
    const base = fallback || BOARD_DEFAULTS;
    const legacyCompletedItemsMode = prefs.completedItemsMode;
    const legacyCompletedSectionsMode = prefs.completedSectionsMode;
    const legacyShowCompletedItems = prefs.showCompletedItems;
    const legacyShowCompletedSections = prefs.showCompletedSections;

    let showFinishedContent = base.showFinishedContent;

    if (typeof prefs.showFinishedContent === "boolean") {
      showFinishedContent = prefs.showFinishedContent;
    } else if (typeof legacyShowCompletedItems === "boolean" || typeof legacyShowCompletedSections === "boolean") {
      showFinishedContent = legacyShowCompletedItems !== false || legacyShowCompletedSections !== false;
    } else if (legacyCompletedItemsMode === "hide" || legacyCompletedSectionsMode === "hide") {
      showFinishedContent = false;
    }

    return {
      showChecklistHeaders: prefs.showChecklistHeaders !== false,
      showFinishedContent,
      showProgressBar: prefs.showProgressBar !== false,
      progressFormat: PROGRESS_FORMATS.includes(prefs.progressFormat)
        ? prefs.progressFormat
        : base.progressFormat,
      itemOrder: ITEM_ORDERS.includes(prefs.itemOrder)
        ? prefs.itemOrder
        : base.itemOrder
    };
  }

  function normalizeMemberPrefs(raw) {
    const prefs = raw || {};

    return {
      usePrivateBoardSettings: Boolean(prefs.usePrivateBoardSettings),
      privateBoardSettings: normalizeBoardPrefs(
        prefs.privateBoardSettings,
        BOARD_DEFAULTS
      )
    };
  }

  async function getPreferences(t) {
    const [boardPrefs, memberPrefs] = await Promise.all([
      t.get("board", "shared").catch(() => ({})),
      t.get("member", "private").catch(() => ({}))
    ]);

    const normalizedBoard = normalizeBoardPrefs(boardPrefs);
    const normalizedMember = normalizeMemberPrefs(memberPrefs);

    return {
      board: normalizedBoard,
      member: normalizedMember,
      effective: normalizedMember.usePrivateBoardSettings
        ? normalizedMember.privateBoardSettings
        : normalizedBoard
    };
  }

  function saveBoardPreferences(t, prefs) {
    return t.set("board", "shared", normalizeBoardPrefs(prefs));
  }

  function saveMemberPreferences(t, prefs) {
    return t.set("member", "private", normalizeMemberPrefs(prefs));
  }

  function getRestApiClient(t) {
    if (!hasApiKey()) {
      throw new Error("Missing Trello API key in config.js.");
    }

    return t.getRestApi();
  }

  async function isAuthorized(t) {
    const client = await getRestApiClient(t);
    return client.isAuthorized();
  }

  async function authorizeMember(t) {
    const client = await getRestApiClient(t);
    return client.authorize({
      scope: "read",
      expiration: "never"
    });
  }

  async function clearAuthorization(t) {
    const client = await getRestApiClient(t);
    return client.clearToken();
  }

  async function getToken(t) {
    const client = await getRestApiClient(t);
    return client.getToken();
  }

  async function fetchTrelloJson(path, token, params) {
    const config = getConfig();
    const query = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, value);
      }
    });

    query.set("key", config.appKey);
    query.set("token", token);

    const response = await fetch(`https://api.trello.com/1${path}?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`Trello API request failed with ${response.status}.`);
    }

    return response.json();
  }

  function sortCheckItems(items) {
    return items.slice().sort((left, right) => {
      if ((left.pos || 0) !== (right.pos || 0)) {
        return (left.pos || 0) - (right.pos || 0);
      }

      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  }

  function sortCheckItemsIncompleteFirst(items) {
    return items.slice().sort((left, right) => {
      if (left.checked !== right.checked) {
        return left.checked ? 1 : -1;
      }

      if ((left.pos || 0) !== (right.pos || 0)) {
        return (left.pos || 0) - (right.pos || 0);
      }

      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  }

  function sortChecklists(checklists) {
    return checklists.slice().sort((left, right) => {
      if ((left.pos || 0) !== (right.pos || 0)) {
        return (left.pos || 0) - (right.pos || 0);
      }

      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  }

  function normalizeChecklistData(rawChecklists) {
    return sortChecklists(Array.isArray(rawChecklists) ? rawChecklists : []).map((checklist, checklistIndex) => {
      const items = sortCheckItems(Array.isArray(checklist.checkItems) ? checklist.checkItems : [])
        .map((item, itemIndex) => ({
          id: item.id || `${checklist.id || checklistIndex}-${itemIndex}`,
          name: String(item.name || "Untitled item").trim() || "Untitled item",
          checked: item.state === "complete",
          pos: Number(item.pos) || itemIndex,
          due: item.due || null,
          dueComplete: Boolean(item.dueComplete)
        }));

      const completeCount = items.filter((item) => item.checked).length;
      const totalCount = items.length;

      return {
        id: checklist.id || `${checklistIndex}`,
        name: String(checklist.name || "Checklist").trim() || "Checklist",
        pos: Number(checklist.pos) || checklistIndex,
        items,
        totalCount,
        completeCount,
        incompleteCount: Math.max(0, totalCount - completeCount)
      };
    });
  }

  function orderChecklistItems(items, itemOrder) {
    if (itemOrder === "original") {
      return sortCheckItems(items);
    }

    return sortCheckItemsIncompleteFirst(items);
  }

  async function fetchCardChecklists(cardId, token) {
    return fetchTrelloJson(`/cards/${cardId}/checklists`, token, {
      checkItems: "all",
      fields: "name,pos",
      checkItem_fields: "name,state,pos,due,dueComplete"
    });
  }

  function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 1).trimEnd()}...`;
  }

  function padBadgeRowText(text) {
    return `${truncate(text, 140)}${BADGE_ROW_PADDING}`;
  }

  function createProgressText(completeCount, totalCount) {
    if (!totalCount) {
      return "0/0";
    }

    return `${completeCount}/${totalCount}`;
  }

  function createPercentText(completeCount, totalCount) {
    if (!totalCount) {
      return "0%";
    }

    return `${Math.round((completeCount / totalCount) * 100)}%`;
  }

  function createProgressBarText(completeCount, totalCount) {
    if (!totalCount) {
      return "▱▱▱▱▱▱▱▱";
    }

    const percent = (completeCount / totalCount) * 100;
    const filledCount = Math.round((percent / 100) * 8);
    return `${"▰".repeat(filledCount)}${"▱".repeat(8 - filledCount)}`;
  }

  function buildChecklistHeaderBadge(checklist, prefs) {
    const normalizedPrefs = normalizeBoardPrefs(prefs);
    const progressText = normalizedPrefs.progressFormat === "count"
      ? createProgressText(checklist.completeCount, checklist.totalCount)
      : createPercentText(checklist.completeCount, checklist.totalCount);
    const progressBarText = createProgressBarText(checklist.completeCount, checklist.totalCount);
    const sectionColor = checklist.incompleteCount === 0 ? "green" : "red";
    const headerText = normalizedPrefs.showProgressBar
      ? `${checklist.name} [${progressText}] / ${progressBarText}`
      : `${checklist.name} [${progressText}]`;

    return {
      text: padBadgeRowText(headerText),
      color: sectionColor
    };
  }

  function buildChecklistItemBadge(item, prefs) {
    return {
      text: padBadgeRowText(`  ${item.checked ? "\u2611" : "\u2610"} ${item.name}`)
    };
  }

  function buildChecklistRowBadges(checklists, prefs) {
    const normalizedPrefs = normalizeBoardPrefs(prefs);
    const normalizedChecklists = normalizeChecklistData(checklists);
    const badges = [];

    normalizedChecklists.forEach((checklist) => {
      const orderedItems = orderChecklistItems(checklist.items, normalizedPrefs.itemOrder);
      const visibleItems = orderedItems.filter((item) => (
        normalizedPrefs.showFinishedContent || !item.checked
      ));
      const sectionIsComplete = checklist.incompleteCount === 0 && checklist.totalCount > 0;

      if (sectionIsComplete && !normalizedPrefs.showFinishedContent) {
        return;
      }

      if (normalizedPrefs.showChecklistHeaders) {
        badges.push(buildChecklistHeaderBadge(checklist, normalizedPrefs));
      }

      visibleItems.forEach((item) => {
        badges.push(buildChecklistItemBadge(item, normalizedPrefs));
      });
    });

    return badges;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.ChecklistPowerUp = {
    BOARD_DEFAULTS,
    MEMBER_DEFAULTS,
    PROGRESS_FORMATS,
    ITEM_ORDERS,
    getConfig,
    hasApiKey,
    getInitOptions,
    normalizeBoardPrefs,
    normalizeMemberPrefs,
    getPreferences,
    saveBoardPreferences,
    saveMemberPreferences,
    getRestApiClient,
    isAuthorized,
    authorizeMember,
    clearAuthorization,
    getToken,
    fetchTrelloJson,
    fetchCardChecklists,
    normalizeChecklistData,
    buildChecklistRowBadges,
    createProgressText,
    createPercentText,
    createProgressBarText,
    padBadgeRowText,
    truncate,
    escapeHtml
  };
})();
