(function () {
  const App = window.ChecklistPowerUp;

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
      console.log(
        "[ChecklistPowerUp][card-badges] t.card('all') summary",
        summarizeCardBadgePayload(card)
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

  async function getSummaryAndPrefs(t) {
    const [prefs, card] = await Promise.all([
      App.getPreferences(t),
      t.card("name", "checklists")
    ]);

    return {
      prefs,
      card,
      summary: App.summarizeChecklists(card.checklists)
    };
  }

  const capabilities = {
    "show-settings": function (t) {
      return openSettingsPopup(t);
    },
    "card-badges": async function (t) {
      // Keep a guaranteed badge visible while we inspect the real card payload in Trello.
      await inspectCardBadgePayload(t);
      return [buildDiagnosticBadge()];
    }
  };

  window.TrelloPowerUp.initialize(capabilities);
})();
