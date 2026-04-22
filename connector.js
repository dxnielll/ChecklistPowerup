(function () {
  const App = window.ChecklistPowerUp;
  const CARD_SECTION_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23626f86' d='M2 3.25A1.25 1.25 0 0 1 3.25 2h9.5A1.25 1.25 0 0 1 14 3.25v9.5A1.25 1.25 0 0 1 12.75 14h-9.5A1.25 1.25 0 0 1 2 12.75v-9.5Zm1.5.25v2h2v-2h-2Zm3.25.25a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5ZM6 8a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 6 8Zm0 3.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 6 11.5Zm-2.5-3.25v2h2v-2h-2Zm0 3.25v1h2v-1h-2Z'/%3E%3C/svg%3E";

  function buildDiagnosticBadge() {
    return {
      text: "Checklist active",
      color: "blue"
    };
  }

  function summarizeCardBadgePayload(card) {
    const topLevelKeys = card && typeof card === "object"
      ? Object.keys(card).sort()
      : [];
    const checklists = Array.isArray(card?.checklists) ? card.checklists : [];
    const firstChecklist = checklists[0] || null;
    const firstChecklistKeys = firstChecklist && typeof firstChecklist === "object"
      ? Object.keys(firstChecklist).sort()
      : [];
    const firstChecklistItems = Array.isArray(firstChecklist?.checkItems)
      ? firstChecklist.checkItems
      : [];
    const firstCheckItem = firstChecklistItems[0] || null;
    const firstCheckItemKeys = firstCheckItem && typeof firstCheckItem === "object"
      ? Object.keys(firstCheckItem).sort()
      : [];

    return {
      topLevelKeys,
      checklistCount: checklists.length,
      hasCheckItemsArray: checklists.some((checklist) => Array.isArray(checklist?.checkItems)),
      checklistItemCounts: checklists.map((checklist) => (
        Array.isArray(checklist?.checkItems) ? checklist.checkItems.length : null
      )),
      firstChecklistKeys,
      firstCheckItemKeys,
      checklistPreview: checklists.slice(0, 3).map((checklist) => ({
        id: checklist?.id || null,
        name: checklist?.name || null,
        keys: checklist && typeof checklist === "object" ? Object.keys(checklist).sort() : [],
        itemCount: Array.isArray(checklist?.checkItems) ? checklist.checkItems.length : null
      }))
    };
  }

  async function inspectCardBadgePayload(t) {
    try {
      const card = await t.card("all");
      const firstChecklist = Array.isArray(card?.checklists) ? card.checklists[0] : null;
      const firstChecklistItems = firstChecklist?.checkItems;

      console.log(
        "[ChecklistPowerUp][card-badges] t.card('all') summary",
        summarizeCardBadgePayload(card)
      );
      console.log("[ChecklistPowerUp][card-badges] raw badges", card?.badges);
      console.log("[ChecklistPowerUp][card-badges] raw first checklist", firstChecklist);
      console.log("[ChecklistPowerUp][card-badges] raw first checklist checkItems", firstChecklistItems);
      console.log("[ChecklistPowerUp][card-badges] first checklist checkItems typeof", typeof firstChecklistItems);
      console.log(
        "[ChecklistPowerUp][card-badges] first checklist checkItems isArray",
        Array.isArray(firstChecklistItems)
      );
    } catch (error) {
      console.error(
        "[ChecklistPowerUp][card-badges] Could not inspect t.card('all')",
        error
      );
    }
  }

  function openSettingsPopup(t) {
    return t.popup({
      title: "Checklist settings",
      url: t.signUrl("./settings.html"),
      height: 780
    });
  }

  const capabilities = {
    "show-settings": function (t) {
      return openSettingsPopup(t);
    },
    "card-badges": async function (t) {
      // Keep a guaranteed badge visible while we inspect the real card payload in Trello.
      await inspectCardBadgePayload(t);
      return [buildDiagnosticBadge()];
    },
    "card-back-section": function (t) {
      return {
        title: "Checklist diagnostics",
        icon: CARD_SECTION_ICON,
        content: {
          type: "iframe",
          url: t.signUrl("./card-section.html"),
          height: 520
        },
        action: {
          text: "Settings",
          callback: openSettingsPopup
        }
      };
    }
  };

  window.TrelloPowerUp.initialize(capabilities);
})();
