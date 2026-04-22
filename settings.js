(function () {
  const App = window.ChecklistPowerUp;
  const t = window.TrelloPowerUp.iframe();

  const boardPermissionPill = document.getElementById("board-permission-pill");
  const saveBoardBtn = document.getElementById("save-board-btn");
  const saveMemberBtn = document.getElementById("save-member-btn");
  const closeBtn = document.getElementById("close-btn");
  const usePrivateBoardSettings = document.getElementById("use-private-board-settings");
  const privateSettingsPanel = document.getElementById("private-settings-panel");
  const statusEl = document.getElementById("settings-status");

  let canWriteBoard = false;

  const boardInputs = {
    showCompleteChecklists: document.getElementById("board-show-complete-checklists"),
    incompleteChecklistLimit: document.getElementById("board-incomplete-checklist-limit"),
    showChecklistTitle: document.getElementById("board-show-checklist-title"),
    completeColor: document.getElementById("board-complete-color"),
    incompleteColor: document.getElementById("board-incomplete-color"),
    showChecklistProgress: document.getElementById("board-show-checklist-progress"),
    progressFormat: document.getElementById("board-progress-format"),
    showCompleteItems: document.getElementById("board-show-complete-items"),
    incompleteItemLimit: document.getElementById("board-incomplete-item-limit")
  };

  const privateInputs = {
    showCompleteChecklists: document.getElementById("private-show-complete-checklists"),
    incompleteChecklistLimit: document.getElementById("private-incomplete-checklist-limit"),
    showChecklistTitle: document.getElementById("private-show-checklist-title"),
    completeColor: document.getElementById("private-complete-color"),
    incompleteColor: document.getElementById("private-incomplete-color"),
    showChecklistProgress: document.getElementById("private-show-checklist-progress"),
    progressFormat: document.getElementById("private-progress-format"),
    showCompleteItems: document.getElementById("private-show-complete-items"),
    incompleteItemLimit: document.getElementById("private-incomplete-item-limit")
  };

  function setStatus(message, tone) {
    statusEl.textContent = message;
    statusEl.className = "status-text";
    if (tone) {
      statusEl.classList.add(tone);
    }
  }

  function updateBoardPermissionState() {
    const inputs = Object.values(boardInputs).concat(saveBoardBtn);

    inputs.forEach((input) => {
      input.disabled = !canWriteBoard;
    });

    boardPermissionPill.textContent = canWriteBoard ? "Can edit board defaults" : "Board defaults are read-only";
    boardPermissionPill.className = canWriteBoard ? "pill pill-success" : "pill pill-warning";
  }

  function setInputs(targets, values) {
    Object.entries(targets).forEach(([key, input]) => {
      if (!input) {
        return;
      }

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

  function updatePrivatePanelState() {
    privateSettingsPanel.classList.toggle("is-disabled", !usePrivateBoardSettings.checked);
    Object.values(privateInputs).forEach((input) => {
      input.disabled = !usePrivateBoardSettings.checked;
    });
  }

  function populateForms(preferences) {
    setInputs(boardInputs, preferences.board);
    usePrivateBoardSettings.checked = preferences.member.usePrivateBoardSettings;
    setInputs(privateInputs, preferences.member.privateBoardSettings);
    updatePrivatePanelState();
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
    populateForms(preferences);

    if (typeof t.memberCanWriteToModel === "function") {
      canWriteBoard = t.memberCanWriteToModel("board");
    } else {
      const context = t.getContext();
      canWriteBoard = context?.permissions?.board === "write";
    }

    updateBoardPermissionState();
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

  saveBoardBtn.addEventListener("click", async () => {
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

  saveMemberBtn.addEventListener("click", async () => {
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

  closeBtn.addEventListener("click", () => {
    t.closePopup();
  });

  usePrivateBoardSettings.addEventListener("change", async () => {
    updatePrivatePanelState();
    await syncHeight();
  });

  t.render(async () => {
    try {
      await loadSettings();
    } catch (error) {
      setStatus(`Could not load settings: ${error.message}`, "error");
      await syncHeight();
    }
  });
})();
