(function () {
  const App = window.ChecklistPowerUp;
  const t = window.TrelloPowerUp.iframe();

  const statusEl = document.getElementById("card-section-status");
  const cardNameEl = document.getElementById("card-section-card-name");
  const progressEl = document.getElementById("card-section-progress");
  const checklistCountEl = document.getElementById("card-section-checklist-count");
  const totalItemsEl = document.getElementById("card-section-total-items");
  const completeItemsEl = document.getElementById("card-section-complete-items");
  const progressBarEl = document.getElementById("card-section-progress-bar");
  const checklistListEl = document.getElementById("card-section-checklist-list");
  const checklistEmptyEl = document.getElementById("card-section-empty");

  function setStatus(message, tone) {
    statusEl.textContent = message;
    statusEl.className = "status-text";
    if (tone) {
      statusEl.classList.add(tone);
    }
  }

  function renderChecklistNames(model) {
    if (!model.showChecklistNames || !model.visibleChecklistNames.length) {
      checklistListEl.innerHTML = "";
      checklistEmptyEl.hidden = false;
      checklistEmptyEl.textContent = model.checklistCount
        ? "Checklist names are hidden by the current settings."
        : "This card does not have any checklists yet.";
      return;
    }

    checklistEmptyEl.hidden = true;
    const items = model.visibleChecklistNames.map((name) => (
      `<li class="check-item"><span class="check-name">${App.escapeHtml(name)}</span></li>`
    ));

    if (model.hiddenChecklistCount > 0) {
      items.push(
        `<li class="check-item"><span class="check-name">+${App.escapeHtml(String(model.hiddenChecklistCount))} more checklist${model.hiddenChecklistCount === 1 ? "" : "s"}</span></li>`
      );
    }

    checklistListEl.innerHTML = items.join("");
  }

  function syncProgressBar(model) {
    const percent = model.totalItems
      ? Math.round((model.completeItems / model.totalItems) * 100)
      : 0;
    progressBarEl.style.width = `${percent}%`;
  }

  async function syncHeight() {
    try {
      await t.sizeTo("#content");
    } catch (error) {
      return null;
    }

    return null;
  }

  t.render(async function () {
    try {
      const [preferences, card] = await Promise.all([
        App.getPreferences(t),
        t.card("all")
      ]);
      const model = App.buildCardBackSummaryModel(card, preferences.effective);

      cardNameEl.textContent = model.cardName;
      progressEl.textContent = model.progressFormat === "percent"
        ? model.percentText
        : model.progressText;
      checklistCountEl.textContent = String(model.checklistCount);
      totalItemsEl.textContent = String(model.totalItems);
      completeItemsEl.textContent = String(model.completeItems);
      syncProgressBar(model);
      renderChecklistNames(model);
      setStatus("Loaded checklist summary.", "success");
    } catch (error) {
      cardNameEl.textContent = "Checklist summary unavailable";
      progressEl.textContent = "Could not load";
      checklistCountEl.textContent = "0";
      totalItemsEl.textContent = "0";
      completeItemsEl.textContent = "0";
      progressBarEl.style.width = "0%";
      checklistListEl.innerHTML = "";
      checklistEmptyEl.hidden = false;
      checklistEmptyEl.textContent = "Could not load the checklist summary for this card.";
      setStatus(`Could not load checklist summary: ${error.message}`, "error");
    }

    await syncHeight();
  });
})();
