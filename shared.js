(function () {
  const BOARD_DEFAULTS = {
    showChecklistNames: true,
    maxVisibleChecklists: "2",
    showOverallProgress: true,
    progressFormat: "count"
  };

  const MEMBER_DEFAULTS = {
    usePrivateBoardSettings: false,
    privateBoardSettings: BOARD_DEFAULTS
  };

  const CHECKLIST_LIMIT_OPTIONS = ["0", "1", "2", "3", "all"];
  const PROGRESS_FORMATS = ["count", "percent"];
  const BADGE_COLORS = [
    "blue",
    "green",
    "orange",
    "red",
    "yellow",
    "purple",
    "pink",
    "sky",
    "lime",
    "light-gray"
  ];

  function normalizeLimit(value, fallback) {
    const normalized = String(value);
    return CHECKLIST_LIMIT_OPTIONS.includes(normalized) ? normalized : fallback;
  }

  function normalizeBoardPrefs(raw, fallback) {
    const prefs = raw || {};
    const base = fallback || BOARD_DEFAULTS;

    return {
      showChecklistNames: prefs.showChecklistNames !== false,
      maxVisibleChecklists: normalizeLimit(
        prefs.maxVisibleChecklists,
        String(base.maxVisibleChecklists)
      ),
      showOverallProgress: prefs.showOverallProgress !== false,
      progressFormat: PROGRESS_FORMATS.includes(prefs.progressFormat)
        ? prefs.progressFormat
        : base.progressFormat
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

  function parseLimit(limitValue) {
    if (limitValue === "all") {
      return Number.POSITIVE_INFINITY;
    }

    const parsed = Number.parseInt(limitValue, 10);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  }

  function createProgressText(completeCount, totalCount) {
    if (!totalCount) {
      return "0/0 complete";
    }

    return `${completeCount}/${totalCount} complete`;
  }

  function createPercentText(completeCount, totalCount) {
    if (!totalCount) {
      return "0% complete";
    }

    return `${Math.round((completeCount / totalCount) * 100)}% complete`;
  }

  function createCompactPercentText(completeCount, totalCount) {
    if (!totalCount) {
      return "0%";
    }

    return `${Math.round((completeCount / totalCount) * 100)}%`;
  }

  function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 1).trimEnd()}...`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDate(dateString) {
    if (!dateString) {
      return "";
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function getChecklistNames(card) {
    return (Array.isArray(card?.checklists) ? card.checklists : [])
      .map((checklist) => String(checklist?.name || "").trim())
      .filter(Boolean);
  }

  function getChecklistTotalsFromBadges(card) {
    const totalItems = Number(card?.badges?.checkItems);
    const completeItems = Number(card?.badges?.checkItemsChecked);
    const normalizedTotal = Number.isFinite(totalItems) && totalItems >= 0 ? totalItems : 0;
    const normalizedComplete = Number.isFinite(completeItems) && completeItems >= 0
      ? Math.min(completeItems, normalizedTotal)
      : 0;

    return {
      totalItems: normalizedTotal,
      completeItems: normalizedComplete,
      incompleteItems: Math.max(0, normalizedTotal - normalizedComplete)
    };
  }

  function buildOverflowBadge(hiddenCount) {
    if (hiddenCount <= 0) {
      return null;
    }

    return {
      text: `+${hiddenCount} more`,
      color: "light-gray"
    };
  }

  function buildProgressBadgeFromBadgesPayload(card, prefs) {
    const normalizedPrefs = normalizeBoardPrefs(prefs);
    const totals = getChecklistTotalsFromBadges(card);

    if (!normalizedPrefs.showOverallProgress) {
      return null;
    }

    if (!totals.totalItems) {
      return {
        text: "No checklist items",
        color: "light-gray"
      };
    }

    return {
      text: normalizedPrefs.progressFormat === "percent"
        ? createCompactPercentText(totals.completeItems, totals.totalItems)
        : createProgressText(totals.completeItems, totals.totalItems),
      color: totals.incompleteItems === 0 ? "green" : "blue"
    };
  }

  function buildFrontCardBadgesFromAvailableData(card, prefs) {
    const normalizedPrefs = normalizeBoardPrefs(prefs);
    const checklistNames = getChecklistNames(card);
    const totals = getChecklistTotalsFromBadges(card);
    const visibleChecklistCount = parseLimit(normalizedPrefs.maxVisibleChecklists);
    const badges = [];
    const progressBadge = buildProgressBadgeFromBadgesPayload(card, normalizedPrefs);

    if (!checklistNames.length && !totals.totalItems) {
      return [];
    }

    if (progressBadge) {
      badges.push(progressBadge);
    }

    if (checklistNames.length) {
      badges.push({
        text: checklistNames.length === 1 ? "1 checklist" : `${checklistNames.length} checklists`,
        color: "light-gray"
      });
    }

    if (normalizedPrefs.showChecklistNames && visibleChecklistCount > 0) {
      const visibleChecklistNames = checklistNames.slice(0, visibleChecklistCount);
      visibleChecklistNames.forEach((name) => {
        badges.push({
          text: truncate(name, 32),
          color: "light-gray"
        });
      });

      const overflowBadge = buildOverflowBadge(checklistNames.length - visibleChecklistNames.length);
      if (overflowBadge) {
        badges.push(overflowBadge);
      }
    }

    return badges.slice(0, 8);
  }

  function buildCardBackSummaryModel(card, prefs) {
    const normalizedPrefs = normalizeBoardPrefs(prefs);
    const checklistNames = getChecklistNames(card);
    const totals = getChecklistTotalsFromBadges(card);
    const visibleChecklistCount = parseLimit(normalizedPrefs.maxVisibleChecklists);
    const visibleChecklistNames = normalizedPrefs.showChecklistNames && visibleChecklistCount > 0
      ? checklistNames.slice(0, visibleChecklistCount)
      : [];

    return {
      cardName: String(card?.name || "Untitled card").trim() || "Untitled card",
      checklistCount: checklistNames.length,
      checklistNames,
      visibleChecklistNames,
      hiddenChecklistCount: Math.max(0, checklistNames.length - visibleChecklistNames.length),
      totalItems: totals.totalItems,
      completeItems: totals.completeItems,
      incompleteItems: totals.incompleteItems,
      progressText: createProgressText(totals.completeItems, totals.totalItems),
      percentText: createPercentText(totals.completeItems, totals.totalItems),
      showChecklistNames: normalizedPrefs.showChecklistNames,
      showOverallProgress: normalizedPrefs.showOverallProgress,
      progressFormat: normalizedPrefs.progressFormat
    };
  }

  window.ChecklistPowerUp = {
    BOARD_DEFAULTS,
    MEMBER_DEFAULTS,
    CHECKLIST_LIMIT_OPTIONS,
    PROGRESS_FORMATS,
    BADGE_COLORS,
    normalizeBoardPrefs,
    normalizeMemberPrefs,
    getPreferences,
    saveBoardPreferences,
    saveMemberPreferences,
    parseLimit,
    getChecklistNames,
    getChecklistTotalsFromBadges,
    buildProgressBadgeFromBadgesPayload,
    buildFrontCardBadgesFromAvailableData,
    buildCardBackSummaryModel,
    createProgressText,
    createPercentText,
    truncate,
    formatDate,
    escapeHtml
  };
})();
