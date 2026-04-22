(function () {
  const App = window.ChecklistPowerUp;

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
      try {
        const { prefs, summary } = await getSummaryAndPrefs(t);
        return App.buildCardBadges(summary, prefs.effective);
      } catch (error) {
        return [];
      }
    }
  };

  window.TrelloPowerUp.initialize(capabilities);
})();
