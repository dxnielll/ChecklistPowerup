(function () {
  const App = window.ChecklistPowerUp;
  const t = window.TrelloPowerUp.iframe();

  const statusEl = document.getElementById("card-section-status");
  const summaryEl = document.getElementById("card-section-summary");
  const badgesEl = document.getElementById("card-section-badges");
  const firstChecklistEl = document.getElementById("card-section-first-checklist");
  const checkItemsEl = document.getElementById("card-section-check-items");

  function setStatus(message, tone) {
    statusEl.textContent = message;
    statusEl.className = "status-text";
    if (tone) {
      statusEl.classList.add(tone);
    }
  }

  function formatJson(value) {
    if (value === undefined) {
      return "undefined";
    }

    if (typeof value === "string") {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return `Could not serialize value: ${error.message}`;
    }
  }

  function summarizeCardSectionPayload(card) {
    const checklists = Array.isArray(card?.checklists) ? card.checklists : [];
    const firstChecklist = checklists[0] || null;
    const firstChecklistItems = firstChecklist?.checkItems;

    return {
      cardName: card?.name || "Untitled card",
      topLevelKeys: card && typeof card === "object" ? Object.keys(card).sort() : [],
      checklistCount: checklists.length,
      firstChecklistKeys: firstChecklist && typeof firstChecklist === "object"
        ? Object.keys(firstChecklist).sort()
        : [],
      checkItemsType: typeof firstChecklistItems,
      checkItemsIsArray: Array.isArray(firstChecklistItems),
      checkItemsLength: Array.isArray(firstChecklistItems) ? firstChecklistItems.length : null
    };
  }

  function renderSummary(summary) {
    summaryEl.innerHTML = [
      `<p><strong>Card:</strong> ${App.escapeHtml(summary.cardName)}</p>`,
      `<p><strong>Checklist count:</strong> ${App.escapeHtml(String(summary.checklistCount))}</p>`,
      `<p><strong>checkItems typeof:</strong> ${App.escapeHtml(summary.checkItemsType)}</p>`,
      `<p><strong>checkItems isArray:</strong> ${App.escapeHtml(String(summary.checkItemsIsArray))}</p>`,
      `<p><strong>checkItems length:</strong> ${App.escapeHtml(String(summary.checkItemsLength))}</p>`,
      `<p><strong>Top-level keys:</strong> ${App.escapeHtml(summary.topLevelKeys.join(", "))}</p>`,
      `<p><strong>First checklist keys:</strong> ${App.escapeHtml(summary.firstChecklistKeys.join(", "))}</p>`
    ].join("");
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
      const card = await t.card("all");
      const firstChecklist = Array.isArray(card?.checklists) ? card.checklists[0] : null;
      const firstChecklistItems = firstChecklist?.checkItems;
      const summary = summarizeCardSectionPayload(card);

      console.log("[ChecklistPowerUp][card-back-section] t.card('all') summary", summary);
      console.log("[ChecklistPowerUp][card-back-section] raw badges", card?.badges);
      console.log("[ChecklistPowerUp][card-back-section] raw first checklist", firstChecklist);
      console.log("[ChecklistPowerUp][card-back-section] raw first checklist checkItems", firstChecklistItems);
      console.log("[ChecklistPowerUp][card-back-section] first checklist checkItems typeof", typeof firstChecklistItems);
      console.log(
        "[ChecklistPowerUp][card-back-section] first checklist checkItems isArray",
        Array.isArray(firstChecklistItems)
      );

      renderSummary(summary);
      badgesEl.textContent = formatJson(card?.badges);
      firstChecklistEl.textContent = formatJson(firstChecklist);
      checkItemsEl.textContent = formatJson(firstChecklistItems);
      setStatus("Loaded card diagnostics.", "success");
    } catch (error) {
      summaryEl.innerHTML = "";
      badgesEl.textContent = "Could not load badges.";
      firstChecklistEl.textContent = "Could not load first checklist.";
      checkItemsEl.textContent = "Could not load checkItems.";
      setStatus(`Could not load card diagnostics: ${error.message}`, "error");
    }

    await syncHeight();
  });
})();
