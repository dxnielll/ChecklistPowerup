(function () {
  const BOARD_DEFAULTS = {
    showCompleteChecklists: true,
    incompleteChecklistLimit: "all",
    showChecklistTitle: true,
    completeColor: "green",
    incompleteColor: "orange",
    showChecklistProgress: true,
    progressFormat: "count",
    showCompleteItems: true,
    incompleteItemLimit: "all"
  };

  const MEMBER_DEFAULTS = {
    usePrivateBoardSettings: false,
    privateBoardSettings: BOARD_DEFAULTS
  };

  const LIMIT_OPTIONS = ["0", "1", "2", "3", "all"];
  const CHECKLIST_LIMIT_OPTIONS = ["1", "2", "3", "all"];
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

  function normalizeLimit(value, allowed, fallback) {
    const normalized = String(value);
    return allowed.includes(normalized) ? normalized : fallback;
  }

  function normalizeBoardPrefs(raw, fallback) {
    const prefs = raw || {};
    const base = fallback || BOARD_DEFAULTS;

    return {
      showCompleteChecklists: prefs.showCompleteChecklists !== false,
      incompleteChecklistLimit: normalizeLimit(
        prefs.incompleteChecklistLimit,
        CHECKLIST_LIMIT_OPTIONS,
        String(base.incompleteChecklistLimit)
      ),
      showChecklistTitle: prefs.showChecklistTitle !== false,
      completeColor: BADGE_COLORS.includes(prefs.completeColor)
        ? prefs.completeColor
        : base.completeColor,
      incompleteColor: BADGE_COLORS.includes(prefs.incompleteColor)
        ? prefs.incompleteColor
        : base.incompleteColor,
      showChecklistProgress: prefs.showChecklistProgress !== false,
      progressFormat: PROGRESS_FORMATS.includes(prefs.progressFormat)
        ? prefs.progressFormat
        : base.progressFormat,
      showCompleteItems: prefs.showCompleteItems !== false,
      incompleteItemLimit: normalizeLimit(
        prefs.incompleteItemLimit,
        LIMIT_OPTIONS,
        String(base.incompleteItemLimit)
      )
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

    return {
      board: normalizeBoardPrefs(boardPrefs),
      member: normalizeMemberPrefs(memberPrefs),
      effective: normalizeMemberPrefs(memberPrefs).usePrivateBoardSettings
        ? normalizeMemberPrefs(memberPrefs).privateBoardSettings
        : normalizeBoardPrefs(boardPrefs)
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

  function sortItems(items) {
    return items.slice().sort((left, right) => {
      if (left.checklistOrder !== right.checklistOrder) {
        return left.checklistOrder - right.checklistOrder;
      }
      if (left.pos !== right.pos) {
        return left.pos - right.pos;
      }
      return left.name.localeCompare(right.name);
    });
  }

  function summarizeChecklists(checklists) {
    const normalizedChecklists = (Array.isArray(checklists) ? checklists : []).map(
      (checklist, checklistIndex) => {
        const items = (Array.isArray(checklist.checkItems) ? checklist.checkItems : []).map(
          (item, itemIndex) => ({
            id: item.id || `${checklist.id || checklistIndex}-${itemIndex}`,
            name: String(item.name || "Untitled item").trim() || "Untitled item",
            checked: item.state === "complete",
            due: item.due || null,
            dueComplete: Boolean(item.dueComplete),
            pos: Number(item.pos) || itemIndex,
            checklistId: checklist.id || `${checklistIndex}`,
            checklistName: String(checklist.name || "Checklist").trim() || "Checklist",
            checklistOrder: checklistIndex
          })
        );

        const completeCount = items.filter((item) => item.checked).length;
        const totalCount = items.length;
        const incompleteCount = totalCount - completeCount;

        return {
          id: checklist.id || `${checklistIndex}`,
          name: String(checklist.name || "Checklist").trim() || "Checklist",
          items: sortItems(items),
          order: checklistIndex,
          totalCount,
          completeCount,
          incompleteCount,
          progressText: createProgressText(completeCount, totalCount)
        };
      }
    );

    const items = sortItems(
      normalizedChecklists.flatMap((checklist) => checklist.items)
    );
    const completeCount = items.filter((item) => item.checked).length;
    const totalCount = items.length;
    const incompleteItems = items.filter((item) => !item.checked);

    return {
      checklists: normalizedChecklists,
      items,
      incompleteItems,
      completeCount,
      totalCount,
      incompleteCount: incompleteItems.length,
      progressText: createProgressText(completeCount, totalCount)
    };
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

  function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 1).trimEnd()}...`;
  }

  function buildChecklistProgressText(checklist, prefs) {
    const progressPart = prefs.progressFormat === "percent"
      ? createPercentText(checklist.completeCount, checklist.totalCount)
      : createProgressText(checklist.completeCount, checklist.totalCount);

    if (!prefs.showChecklistTitle) {
      return progressPart;
    }

    return `${progressPart} ${checklist.name}`;
  }

  function buildItemBadgeText(item) {
    return `${item.checked ? "☑" : "☐"} ${item.name}`;
  }

  function visibleChecklists(summary, prefs) {
    const incompleteChecklistLimit = parseLimit(prefs.incompleteChecklistLimit);
    let remainingIncomplete = incompleteChecklistLimit;

    return summary.checklists.filter((checklist) => {
      if (checklist.incompleteCount === 0) {
        return prefs.showCompleteChecklists;
      }

      if (remainingIncomplete <= 0) {
        return false;
      }

      remainingIncomplete -= 1;
      return true;
    });
  }

  function visibleItems(checklist, prefs) {
    const incompleteItemLimit = parseLimit(prefs.incompleteItemLimit);
    let remainingIncomplete = incompleteItemLimit;

    return checklist.items.filter((item) => {
      if (item.checked) {
        return prefs.showCompleteItems;
      }

      if (remainingIncomplete <= 0) {
        return false;
      }

      remainingIncomplete -= 1;
      return true;
    });
  }

  function buildCardBadges(summary, prefs) {
    if (!summary.totalCount) {
      return [];
    }

    const badges = [];
    const boardPrefs = normalizeBoardPrefs(prefs);

    visibleChecklists(summary, boardPrefs).forEach((checklist) => {
      if (boardPrefs.showChecklistProgress) {
        badges.push({
          text: truncate(buildChecklistProgressText(checklist, boardPrefs), 42),
          color: checklist.incompleteCount === 0
            ? boardPrefs.completeColor
            : boardPrefs.incompleteColor
        });
      }

      visibleItems(checklist, boardPrefs).forEach((item) => {
        badges.push({
          text: truncate(buildItemBadgeText(item), 46)
        });
      });
    });

    return badges.slice(0, 48);
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
    CHECKLIST_LIMIT_OPTIONS,
    LIMIT_OPTIONS,
    BADGE_COLORS,
    PROGRESS_FORMATS,
    normalizeBoardPrefs,
    normalizeMemberPrefs,
    getPreferences,
    saveBoardPreferences,
    saveMemberPreferences,
    summarizeChecklists,
    buildCardBadges,
    createProgressText,
    createPercentText,
    truncate,
    formatDate,
    escapeHtml
  };
})();
