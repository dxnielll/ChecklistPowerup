(function () {
  const App = window.ChecklistPowerUp;
  const CARD_SECTION_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23626f86' d='M2 3.25A1.25 1.25 0 0 1 3.25 2h9.5A1.25 1.25 0 0 1 14 3.25v9.5A1.25 1.25 0 0 1 12.75 14h-9.5A1.25 1.25 0 0 1 2 12.75v-9.5Zm1.5.25v2h2v-2h-2Zm3.25.25a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5ZM6 8a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 6 8Zm0 3.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 6 11.5Zm-2.5-3.25v2h2v-2h-2Zm0 3.25v1h2v-1h-2Z'/%3E%3C/svg%3E";

  function openSettingsPopup(t) {
    return t.popup({
      title: "Checklist settings",
      url: t.signUrl("./settings.html"),
      height: 540
    });
  }

  const capabilities = {
    "show-settings": function (t) {
      return openSettingsPopup(t);
    },
    "card-badges": async function (t) {
      try {
        const [preferences, card] = await Promise.all([
          App.getPreferences(t),
          t.card("all")
        ]);

        return App.buildFrontCardBadgesFromAvailableData(card, preferences.effective);
      } catch (error) {
        return [];
      }
    },
    "card-back-section": function (t) {
      return {
        title: "Checklist summary",
        icon: CARD_SECTION_ICON,
        content: {
          type: "iframe",
          url: t.signUrl("./card-section.html"),
          height: 420
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
