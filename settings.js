(function () {
  const App = window.ChecklistPowerUp;
  const initOptions = App.getInitOptions();
  const t = initOptions ? window.TrelloPowerUp.iframe(initOptions) : window.TrelloPowerUp.iframe();

  const boardPermissionPill = document.getElementById("board-permission-pill");
  const authStatusPill = document.getElementById("auth-status-pill");
  const connectBtn = document.getElementById("connect-btn");
  const disconnectBtn = document.getElementById("disconnect-btn");
  const saveBoardBtn = document.getElementById("save-board-btn");
  const saveMemberBtn = document.getElementById("save-member-btn");
  const closeBtn = document.getElementById("close-btn");
  const usePrivateBoardSettings = document.getElementById("use-private-board-settings");
  const privateSettingsPanel = document.getElementById("private-settings-panel");
  const statusEl = document.getElementById("settings-status");

  let canWriteBoard = false;

  const boardInputs = {
    showChecklistHeaders: document.getElementById("board-show-checklist-headers"),
    showCompletedItems: document.getElementById("board-show-completed-items"),
    progressFormat: document.getElementById("board-progress-format")
  };

  const privateInputs = {
    showChecklistHeaders: document.getElementById("private-show-checklist-headers"),
    showCompletedItems: document.getElementById("private-show-completed-items"),
    progressFormat: document.getElementById("private-progress-format")
  };

  function setStatus(message, tone) {
    statusEl.textContent = message;
    statusEl.className = "status-text";
    if (tone) {
      statusEl.classList.add(tone);
    }
  }

  function setInputs(targets, values) {
    Object.entries(targets).forEach(([key, input]) => {
      if (input.type === "checkbox") {
        input.checked = Boolean(values[key]);
        return;
      }

      input.value = String(values[key]);
    });
  }

  function readInputs(targets) {
    return Object.fromEntries(
      Object.entries(targets).map(([key, input]) => {
        if (input.type === "checkbox") {
          return [key, input.checked];
        }

        return [key, input.value];
      })
    );
  }

  function updateBoardPermissionState() {
    const inputs = Object.values(boardInputs).concat(saveBoardBtn);

    inputs.forEach((input) => {
      input.disabled = !canWriteBoard;
    });

    boardPermissionPill.textContent = canWriteBoard ? "Can edit board defaults" : "Board defaults are read-only";
    boardPermissionPill.className = canWriteBoard ? "pill pill-success" : "pill pill-warning";
  }

  function updatePrivatePanelState() {
    privateSettingsPanel.classList.toggle("is-disabled", !usePrivateBoardSettings.checked);
    Object.values(privateInputs).forEach((input) => {
      input.disabled = !usePrivateBoardSettings.checked;
    });
  }

  function setAuthPill(text, toneClass) {
    authStatusPill.textContent = text;
    authStatusPill.className = toneClass ? `pill ${toneClass}` : "pill";
  }

  async function refreshAuthorizationState() {
    if (!App.hasApiKey()) {
      setAuthPill("Missing API key", "pill-warning");
      connectBtn.disabled = true;
      disconnectBtn.disabled = true;
      return;
    }

    try {
      const authorized = await App.isAuthorized(t);
      setAuthPill(authorized ? "Connected" : "Not connected", authorized ? "pill-success" : "pill-warning");
      connectBtn.disabled = authorized;
      disconnectBtn.disabled = !authorized;
    } catch (error) {
      setAuthPill("Auth check failed", "pill-warning");
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    }
  }

  async function syncHeight() {
    try {
      await t.sizeTo("#content");
    } catch (error) {
      return null;
    }

    return null;
  }

  async function loadSettings() {
    const preferences = await App.getPreferences(t);
    setInputs(boardInputs, preferences.board);
    usePrivateBoardSettings.checked = preferences.member.usePrivateBoardSettings;
    setInputs(privateInputs, preferences.member.privateBoardSettings);
    updatePrivatePanelState();

    if (typeof t.memberCanWriteToModel === "function") {
      canWriteBoard = t.memberCanWriteToModel("board");
    } else {
      const context = t.getContext();
      canWriteBoard = context?.permissions?.board === "write";
    }

    updateBoardPermissionState();
    await refreshAuthorizationState();
    setStatus("Loaded current preferences.", "success");
    await syncHeight();
  }

  function readBoardPrefsFromForm() {
    return App.normalizeBoardPrefs(readInputs(boardInputs));
  }

  function readMemberPrefsFromForm() {
    return App.normalizeMemberPrefs({
      usePrivateBoardSettings: usePrivateBoardSettings.checked,
      privateBoardSettings: readInputs(privateInputs)
    });
  }

  connectBtn.addEventListener("click", async function () {
    if (!App.hasApiKey()) {
      setStatus("Add your Trello API key to config.js before connecting access.", "error");
      return;
    }

    connectBtn.disabled = true;
    setStatus("Opening Trello authorization...", "pending");

    try {
      await App.authorizeMember(t);
      await refreshAuthorizationState();
      setStatus("Connected Trello access.", "success");
    } catch (error) {
      setStatus(`Could not connect Trello access: ${error.message}`, "error");
      await refreshAuthorizationState();
    } finally {
      await syncHeight();
    }
  });

  disconnectBtn.addEventListener("click", async function () {
    disconnectBtn.disabled = true;
    setStatus("Disconnecting Trello access...", "pending");

    try {
      await App.clearAuthorization(t);
      await refreshAuthorizationState();
      setStatus("Disconnected Trello access.", "success");
    } catch (error) {
      setStatus(`Could not disconnect Trello access: ${error.message}`, "error");
      await refreshAuthorizationState();
    } finally {
      await syncHeight();
    }
  });

  saveBoardBtn.addEventListener("click", async function () {
    if (!canWriteBoard) {
      setStatus("You need board edit access to save board defaults.", "error");
      return;
    }

    saveBoardBtn.disabled = true;
    setStatus("Saving board defaults...", "pending");

    try {
      await App.saveBoardPreferences(t, readBoardPrefsFromForm());
      setStatus("Saved board defaults.", "success");
    } catch (error) {
      setStatus(`Could not save board defaults: ${error.message}`, "error");
    } finally {
      updateBoardPermissionState();
      await syncHeight();
    }
  });

  saveMemberBtn.addEventListener("click", async function () {
    saveMemberBtn.disabled = true;
    setStatus("Saving your preferences...", "pending");

    try {
      await App.saveMemberPreferences(t, readMemberPrefsFromForm());
      setStatus("Saved your preferences.", "success");
    } catch (error) {
      setStatus(`Could not save your preferences: ${error.message}`, "error");
    } finally {
      saveMemberBtn.disabled = false;
      await syncHeight();
    }
  });

  closeBtn.addEventListener("click", function () {
    t.closePopup();
  });

  usePrivateBoardSettings.addEventListener("change", async function () {
    updatePrivatePanelState();
    await syncHeight();
  });

  t.render(async function () {
    try {
      await loadSettings();
    } catch (error) {
      setStatus(`Could not load settings: ${error.message}`, "error");
      await syncHeight();
    }
  });
})();
