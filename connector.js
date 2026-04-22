(function () {
  const App = window.ChecklistPowerUp;
  const initOptions = App.getInitOptions();

  function openSettingsPopup(t) {
    return t.popup({
      title: "Checklist settings",
      url: t.signUrl("./settings.html"),
      height: 620
    });
  }

  function buildStatusBadge(text, color) {
    return [{ text, color }];
  }

  const capabilities = {
    "show-settings": function (t) {
      return openSettingsPopup(t);
    },
    "card-badges": async function (t) {
      try {
        if (!App.hasApiKey()) {
          return buildStatusBadge("Set Trello API key", "red");
        }

        const [preferences, card] = await Promise.all([
          App.getPreferences(t),
          t.card("id")
        ]);

        const authorized = await App.isAuthorized(t);
        if (!authorized) {
          return buildStatusBadge("Authorize checklist access", "blue");
        }

        const token = await App.getToken(t);
        if (!token) {
          return buildStatusBadge("Authorize checklist access", "blue");
        }

        const checklists = await App.fetchCardChecklists(card.id, token);
        if (!Array.isArray(checklists) || checklists.length === 0) {
          return [];
        }

        return App.buildChecklistRowBadges(checklists, preferences.effective);
      } catch (error) {
        return buildStatusBadge("Checklist data unavailable", "red");
      }
    }
  };

  if (initOptions) {
    window.TrelloPowerUp.initialize(capabilities, initOptions);
  } else {
    window.TrelloPowerUp.initialize(capabilities);
  }
})();
