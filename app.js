(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const SETTINGS_STORAGE_KEY = "siteseller-agent-settings-v1";
  const palettes = [
    ["#27394e", "#a6ceff"], ["#263a35", "#9be0c4"], ["#3a3049", "#d0b7ff"],
    ["#48392d", "#f0ca91"], ["#3a3040", "#e9b2d0"], ["#293b43", "#9edce0"],
  ];
  const statusLabels = {
    new: "New",
    contacted: "Contacted",
    replied: "Replied",
    "opted-out": "Opted out",
    client: "Client",
  };
  const exportColumns = [
    ["id", "ID"],
    ["name", "Business name"],
    ["category", "Category"],
    ["city", "City"],
    ["phone", "Phone"],
    ["email", "Email"],
    ["website", "Website URL"],
    ["hasWebsite", "Has website"],
    ["score", "Lead score"],
    ["status", "Status"],
    ["reviews", "Review count"],
    ["isDemo", "Demo record"],
    ["createdAt", "Created at"],
    ["updatedAt", "Updated at"],
  ];
  const viewNames = {
    overview: "Overview",
    prospects: "Prospects",
    discovery: "Lead discovery",
    campaigns: "Campaigns",
    outreach: "Outreach",
    sites: "Site generator",
    settings: "Settings",
  };
  const initialSettings = {
    city: "Portland",
    country: "United States",
    niche: "Independent local businesses",
    limit: "20",
    senderName: "",
    senderEmail: "",
    address: "",
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function readSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
      return stored && typeof stored === "object" && !Array.isArray(stored)
        ? { ...initialSettings, ...stored }
        : { ...initialSettings };
    } catch {
      return { ...initialSettings };
    }
  }

  const state = {
    prospects: [],
    settings: readSettings(),
    loading: true,
    loadError: "",
  };

  function initialsFor(name) {
    return String(name || "").trim().split(/\s+/).slice(0, 2)
      .map((part) => part[0] || "").join("").toUpperCase();
  }

  function withPresentation(prospect) {
    const palette = palettes[(Math.max(1, Number(prospect.id) || 1) - 1) % palettes.length];
    return {
      ...prospect,
      initials: initialsFor(prospect.name),
      palette,
    };
  }

  function avatarStyle(prospect) {
    const [background, color] = prospect.palette || palettes[0];
    return `background:${background};color:${color}`;
  }

  function statusBadge(status) {
    const validStatus = Object.hasOwn(statusLabels, status) ? status : "new";
    return `<span class="status-badge status-${validStatus}">${escapeHtml(statusLabels[validStatus])}</span>`;
  }

  function scoreMarkup(value) {
    const score = Math.max(0, Math.min(100, Number(value) || 0));
    return `<span class="score-wrap" aria-label="Lead score ${score}"><span class="score-track" aria-hidden="true"><i style="width:${score}%"></i></span><span class="score-number">${score}</span></span>`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function sortedByRecent(prospects) {
    return [...prospects].sort((left, right) => {
      const dateDelta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return (Number.isNaN(dateDelta) ? 0 : dateDelta) || Number(right.id) - Number(left.id);
    });
    if (window.matchMedia("(max-width: 850px)").matches) {
      $("#nav-toggle").setAttribute("aria-expanded", "false");
      $("#nav-toggle").setAttribute("aria-label", "Open navigation");
    } else {
      $("#nav-toggle").setAttribute("aria-expanded", "true");
      $("#nav-toggle").setAttribute("aria-label", "Collapse navigation");
    }
    window.addEventListener("resize", () => {
      if (window.matchMedia("(max-width: 850px)").matches) {
        if (!$("#app-shell").classList.contains("mobile-nav-open")) {
          $("#nav-toggle").setAttribute("aria-expanded", "false");
          $("#nav-toggle").setAttribute("aria-label", "Open navigation");
        }
      } else {
        setNavigationExpanded(false);
        const collapsed = $("#app-shell").classList.contains("is-collapsed");
        $("#nav-toggle").setAttribute("aria-expanded", String(!collapsed));
        $("#nav-toggle").setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && $("#app-shell").classList.contains("mobile-nav-open")) {
        setNavigationExpanded(false, { restoreFocus: true });
      }
    });
  }

  function counts() {
    return state.prospects.reduce((result, prospect) => {
      result.total += 1;
      result[prospect.status] = (result[prospect.status] || 0) + 1;
      if (prospect.isDemo) result.demo += 1;
      if (prospect.status === "contacted" || prospect.status === "replied") result.conversation += 1;
      return result;
    }, { total: 0, new: 0, contacted: 0, replied: 0, "opted-out": 0, client: 0, demo: 0, conversation: 0 });
  }

  function prospectRow(prospect, { includeCategory = false, includeScore = false, includeDate = false } = {}) {
    const detailAction = `<button class="row-action" type="button" data-action="details" data-id="${escapeHtml(prospect.id)}" aria-label="View details for ${escapeHtml(prospect.name)}">···</button>`;
    return `<tr>
      <td data-label="Business"><div class="business-cell"><span class="business-avatar" style="${avatarStyle(prospect)}" aria-hidden="true">${escapeHtml(prospect.initials)}</span><span class="business-copy"><strong>${escapeHtml(prospect.name)}${prospect.isDemo ? '<span class="record-tag">DEMO</span>' : ""}</strong><small>${escapeHtml(prospect.email || prospect.phone || "No contact details")}</small></span></div></td>
      ${includeCategory ? `<td data-label="Category"><span class="business-location">${escapeHtml(prospect.category)}</span></td>` : ""}
      <td data-label="Location"><span class="business-location">${escapeHtml(prospect.city)}</span></td>
      ${includeScore ? `<td data-label="Score">${scoreMarkup(prospect.score)}</td>` : ""}
      <td data-label="Status">${statusBadge(prospect.status)}</td>
      ${includeDate ? `<td data-label="Added"><span class="business-location">${escapeHtml(formatDate(prospect.createdAt))}</span></td>` : ""}
      ${includeCategory || includeScore ? `<td data-label="Actions">${detailAction}</td>` : ""}
    </tr>`;
  }

  function renderMetrics() {
    const summary = counts();
    const targets = {
      "overview-total": summary.total,
      "overview-new": summary.new,
      "overview-conversation": summary.conversation,
      "overview-demo": summary.demo,
      "prospect-total": summary.total,
      "prospect-new": summary.new,
      "prospect-conversation": summary.conversation,
      "prospect-demo": summary.demo,
    };
    for (const [id, value] of Object.entries(targets)) {
      $(`#${id}`).textContent = state.loading || state.loadError ? "—" : String(value);
    }
    $("#nav-count").textContent = state.loading || state.loadError ? "—" : String(summary.total);
  }

  function renderOverview() {
    renderMetrics();
    const recent = sortedByRecent(state.prospects).slice(0, 5);
    $("#overview-prospects-body").innerHTML = recent.map((prospect) =>
      prospectRow(prospect, { includeDate: true })).join("");
    $("#overview-loading").classList.toggle("hidden", !state.loading);
    $("#overview-error").classList.toggle("hidden", !state.loadError);
    $("#overview-error-message").textContent = state.loadError;
    $("#overview-empty").classList.toggle("hidden", state.loading || state.prospects.length > 0);
    $(".connection-strip").classList.toggle("hidden", state.loading || Boolean(state.loadError));

    const summary = counts();
    $("#overview-status-summary").innerHTML = Object.entries(statusLabels).map(([status, label]) =>
      `<li><span class="stage-mark stage-${status}"></span><span>${escapeHtml(label)}</span><strong>${state.loading || state.loadError ? "—" : summary[status] || 0}</strong></li>`).join("");
  }

  function currentFilters() {
    return {
      query: $("#prospect-search").value.trim().toLocaleLowerCase(),
      status: $("#status-filter").value,
      minScore: $("#score-filter").value === "all" ? 0 : Number($("#score-filter").value),
    };
  }

  function filteredProspects() {
    const { query, status, minScore } = currentFilters();
    return sortedByRecent(state.prospects.filter((prospect) => {
      const searchable = [prospect.name, prospect.contactName, prospect.contact_name]
        .join(" ").toLocaleLowerCase();
      return searchable.includes(query)
        && (status === "all" || prospect.status === status)
        && Number(prospect.score) >= minScore;
    }));
  }

  function csvCell(value) {
    const text = value == null ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportProspectsCsv() {
    const records = filteredProspects();
    const rows = [
      exportColumns.map(([, label]) => csvCell(label)),
      ...records.map((prospect) => exportColumns.map(([key]) => csvCell(prospect[key]))),
    ];
    const csv = rows.map((row) => row.join(",")).join("\r\n");
    const today = new Date();
    const date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `prospects-export-${date}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    toast(`Exported ${records.length} ${records.length === 1 ? "prospect" : "prospects"} to CSV.`);
  }

  function renderProspects() {
    renderMetrics();
    const loading = $("#prospects-loading");
    const table = $("#prospects-table-wrap");
    const empty = $("#prospects-empty");
    const error = $("#prospect-error");
    const filtered = filteredProspects();
    const hasFilters = Boolean($("#prospect-search").value.trim())
      || $("#status-filter").value !== "all"
      || $("#score-filter").value !== "all";

    loading.classList.toggle("hidden", !state.loading);
    $("#export-prospects").disabled = state.loading || Boolean(state.loadError);
    table.classList.toggle("hidden", state.loading || Boolean(state.loadError) || filtered.length === 0);
    error.classList.toggle("hidden", !state.loadError);
    $("#prospect-error-message").textContent = state.loadError;
    $("#prospects-empty-title").textContent = hasFilters ? "No matching prospects" : "No prospects yet";
    $("#prospects-empty-copy").textContent = hasFilters
      ? "Try another search term or clear one of the filters."
      : "Add a business manually to create your first local record.";
    const emptyAction = $("#prospects-empty-action");
    emptyAction.textContent = hasFilters ? "Clear filters" : "Add your first prospect";
    emptyAction.dataset.action = hasFilters ? "clear-filters" : "add-prospect";
    empty.classList.toggle("hidden", state.loading || Boolean(state.loadError) || filtered.length > 0);
    $("#all-prospects-body").innerHTML = filtered.map((prospect) =>
      prospectRow(prospect, { includeCategory: true, includeScore: true })).join("");
    $("#prospect-result-count").textContent = state.loading
      ? "Loading saved records…"
      : state.loadError
        ? "Saved prospects are unavailable"
        : `Showing ${filtered.length} of ${state.prospects.length} prospects`;
  }

  const conceptSamples = [
    { title: "A thoughtful cup, close to home.", type: "Coffee shop", className: "art-coffee", copy: "A warm, neighborhood-first homepage concept." },
    { title: "Gathered with a little feeling.", type: "Florist", className: "art-flower", copy: "A calm visual direction for seasonal arrangements." },
    { title: "Find your own kind of balance.", type: "Yoga studio", className: "art-studio", copy: "A serene visual direction for a neighborhood studio." },
    { title: "Good things, fresh from the oven.", type: "Bakery", className: "art-bakery", copy: "An illustrative direction for a local bakery." },
    { title: "A good cut. Good company.", type: "Barber shop", className: "art-studio", copy: "A considered concept for a neighborhood barbershop." },
    { title: "Make room for a little green.", type: "Plant shop", className: "art-flower", copy: "A plant-led direction for a small local shop." },
  ];

  function renderSiteConcepts() {
    const demos = state.prospects.filter((prospect) => prospect.isDemo).slice(0, conceptSamples.length);
    $("#site-grid").innerHTML = demos.map((prospect, index) => {
      const sample = conceptSamples.find((item) => item.type === prospect.category) || conceptSamples[index];
      return `<article class="concept-card">
        <div class="concept-art ${sample.className}"><span class="concept-art-label">ILLUSTRATIVE CONCEPT</span><strong>${escapeHtml(sample.title)}</strong><small>${escapeHtml(sample.type)} · Fictional sample</small></div>
        <div class="concept-card-copy"><span>${escapeHtml(prospect.name)} <span class="record-tag">DEMO</span></span><h2>${escapeHtml(sample.copy)}</h2><button class="button button-quiet button-small" data-action="preview-site" data-id="${escapeHtml(prospect.id)}">Open concept preview</button></div>
      </article>`;
    }).join("");
    $("#sites-empty").classList.toggle("hidden", demos.length > 0);
  }

  function renderAll() {
    renderOverview();
    renderProspects();
    renderSiteConcepts();
  }

  function toast(message, tone = "neutral") {
    const item = document.createElement("div");
    item.className = `toast toast-${tone}`;
    item.setAttribute("role", tone === "error" ? "alert" : "status");
    item.textContent = message;
    $("#toast-region").append(item);
    window.setTimeout(() => item.remove(), 4000);
  }

  function setNavigationExpanded(expanded, { restoreFocus = false } = {}) {
    $("#app-shell").classList.toggle("mobile-nav-open", expanded);
    $("#nav-toggle").setAttribute("aria-expanded", String(expanded));
    $("#nav-toggle").setAttribute("aria-label", expanded ? "Close navigation" : "Open navigation");
    if (expanded) $("#mobile-nav-close").focus({ preventScroll: true });
    else if (restoreFocus) $("#nav-toggle").focus({ preventScroll: true });
  }

  function navigate(view, { updateHash = true, focusHeading = true } = {}) {
    if (!Object.hasOwn(viewNames, view)) return;
    $$(".view-section").forEach((section) => {
      const current = section.dataset.page === view;
      section.classList.toggle("hidden", !current);
      section.classList.toggle("is-current", current);
    });
    $$(".nav-link[data-view]").forEach((link) => {
      const active = link.dataset.view === view;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    $("#topbar-title").textContent = viewNames[view];
    if (window.matchMedia("(max-width: 850px)").matches) setNavigationExpanded(false);
    if (view === "overview") renderOverview();
    if (view === "prospects") renderProspects();
    if (view === "sites") renderSiteConcepts();
    if (updateHash && window.location.hash !== `#${view}`) window.location.hash = view;
    if (focusHeading) {
      const heading = $(`#${view}-title`);
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
  }

  function showDialog(title, subtitle, body) {
    $("#dialog-content").innerHTML = `<div class="dialog-head"><div><h2 id="dialog-title">${title}</h2><p>${subtitle}</p></div><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div>`;
    const dialog = $("#app-dialog");
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog() {
    const dialog = $("#app-dialog");
    if (dialog.open) dialog.close();
  }

  function openAddProspect() {
    showDialog("Add a prospect", "Create a record in your local SQLite workspace.", `
      <form class="dialog-form" id="prospect-form">
        <label class="form-label">Business name<input name="name" required maxlength="120" autocomplete="organization" placeholder="e.g. Cedar House Studio"></label>
        <label class="form-label">Business category<input name="category" required maxlength="80" placeholder="e.g. Interior design"></label>
        <label class="form-label">City<input name="city" required maxlength="120" autocomplete="address-level2" placeholder="e.g. Portland, OR"></label>
        <label class="form-label">Email <span class="optional-label">Optional</span><input name="email" type="email" maxlength="254" autocomplete="email" placeholder="hello@example.com"></label>
        <label class="form-label">Phone <span class="optional-label">Optional</span><input name="phone" maxlength="40" autocomplete="tel" placeholder="(555) 555-0100"></label>
        <label class="form-label full-span">Website URL <span class="optional-label">Optional</span><input name="website_url" type="url" maxlength="2048" placeholder="https://example.com"><small>Website status is left unknown when this field is blank.</small></label>
        <p class="form-error hidden" id="add-form-error" role="alert"></p>
        <div class="dialog-actions"><button type="button" class="button button-quiet" data-action="close-dialog">Cancel</button><button type="submit" class="button button-primary" id="add-submit">Save prospect</button></div>
      </form>`);
    $("#prospect-form").addEventListener("submit", submitProspect);
  }

  async function apiRequest(path, options = {}) {
    let response;
    try {
      response = await fetch(path, options);
    } catch {
      throw new Error("The local API could not be reached. Check that the app server is running.");
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error("The local API returned an unreadable response.");
    }
    if (!response.ok) throw new Error(payload.error || `The local API returned ${response.status}.`);
    return payload;
  }

  async function loadProspects() {
    state.loading = true;
    state.loadError = "";
    renderAll();
    try {
      const payload = await apiRequest("/api/prospects");
      if (!Array.isArray(payload)) throw new Error("The local API returned an unexpected prospect list.");
      state.prospects = payload.map(withPresentation);
    } catch (error) {
      state.loadError = error.message;
      state.prospects = [];
      toast(error.message, "error");
    } finally {
      state.loading = false;
      renderAll();
    }
  }

  async function submitProspect(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const submit = $("#add-submit");
    const errorBox = $("#add-form-error");
    const formData = new FormData(form);
    const prospect = Object.fromEntries(formData.entries());
    for (const key of Object.keys(prospect)) prospect[key] = String(prospect[key]).trim();
    submit.disabled = true;
    submit.textContent = "Saving…";
    errorBox.classList.add("hidden");
    try {
      const created = withPresentation(await apiRequest("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prospect),
      }));
      state.prospects = [created, ...state.prospects];
      renderAll();
      closeDialog();
      toast(`${created.name} was saved to the local prospect list.`, "success");
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("hidden");
      submit.disabled = false;
      submit.textContent = "Save prospect";
    }
  }

  function prospectById(id) {
    return state.prospects.find((prospect) => String(prospect.id) === String(id));
  }

  function detailMarkup(prospect) {
    const websiteStatus = prospect.hasWebsite === null
      ? "Unknown — not verified"
      : prospect.hasWebsite
        ? "Yes"
        : prospect.isDemo
          ? "Demo value — not verified"
          : "No";
    const note = prospect.isDemo
      ? "Fictional sample record. Business and contact details are illustrative; no outreach has been sent."
      : "User-added record. Contact details and website availability have not been independently verified.";
    return `<div class="detail-hero"><span class="business-avatar" style="${avatarStyle(prospect)}" aria-hidden="true">${escapeHtml(prospect.initials)}</span><div><h3>${escapeHtml(prospect.name)}${prospect.isDemo ? '<span class="record-tag">DEMO</span>' : ""}</h3><p>${escapeHtml(prospect.category)} · ${escapeHtml(prospect.city)}</p></div></div>
      <div class="detail-score"><strong>Lead score <span class="optional-label">sample / local value</span></strong>${scoreMarkup(prospect.score)}</div>
      <div class="detail-info"><div><span>Email</span><strong>${escapeHtml(prospect.email || "Not provided")}</strong></div><div><span>Phone</span><strong>${escapeHtml(prospect.phone || "Not provided")}</strong></div><div><span>Website</span><strong>${escapeHtml(prospect.website || websiteStatus)}</strong></div><div><span>Added</span><strong>${escapeHtml(formatDate(prospect.createdAt))}</strong></div></div>
      <p class="detail-note">${note}</p>
      <form class="dialog-form" id="status-form" data-id="${escapeHtml(prospect.id)}">
        <label class="form-label">Prospect status<select class="filter-select" name="status">${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${prospect.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <p class="form-error hidden" id="status-form-error" role="alert"></p>
        <div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-dialog">Close</button><button class="button button-primary" type="submit" id="status-submit">Save status</button></div>
      </form>`;
  }

  function openProspectDetails(id) {
    const prospect = prospectById(id);
    if (!prospect) return;
    showDialog("Prospect details", "Review this saved record and update its local status.", detailMarkup(prospect));
    $("#status-form").addEventListener("submit", submitStatus);
  }

  async function submitStatus(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.dataset.id;
    const selectedStatus = new FormData(form).get("status");
    const submit = $("#status-submit");
    const errorBox = $("#status-form-error");
    submit.disabled = true;
    submit.textContent = "Saving…";
    errorBox.classList.add("hidden");
    try {
      const updated = withPresentation(await apiRequest(`/api/prospects/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus }),
      }));
      state.prospects = state.prospects.map((prospect) => String(prospect.id) === String(updated.id) ? updated : prospect);
      renderAll();
      closeDialog();
      toast(`${updated.name} status saved as ${statusLabels[updated.status]}.`, "success");
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove("hidden");
      submit.disabled = false;
      submit.textContent = "Save status";
    }
  }

  function openSitePreview(id) {
    const prospect = prospectById(id);
    if (!prospect) return;
    const title = "A thoughtful online home.";
    showDialog("Illustrative concept preview", `${escapeHtml(prospect.name)} · fictional demo prospect`, `
      <div class="preview-browser"><div class="preview-bar"><i></i><i></i><i></i><span>example.preview · not published</span></div><div class="preview-content"><h3>${title}</h3><p>A visual direction for a local business. This is placeholder content, not a generated site.</p></div></div>
      <p class="preview-disclaimer">Illustrative UI only. No website was generated, hosted, or published.</p>
      <div class="dialog-actions"><button class="button button-quiet" data-action="close-dialog">Close preview</button></div>`);
  }

  function openSimulationPreview(type) {
    const copy = type === "discovery"
      ? {
        title: "Discovery preview",
        subtitle: "A local explanation only. No business search is run.",
        body: "<ol class=\"preview-steps\"><li>Choose a permitted provider and target area.</li><li>Review candidate business details and source provenance.</li><li>Manually approve records before saving them locally.</li></ol>",
      }
      : {
        title: "Campaign workflow preview",
        subtitle: "A local explanation only. No messages are drafted or sent.",
        body: "<ol class=\"preview-steps\"><li>Verify the prospect and sender details.</li><li>Review a proposed message and any demo link.</li><li>Require explicit user approval before a future send.</li></ol>",
      };
    showDialog(copy.title, copy.subtitle, `<div class="preview-disclaimer">${copy.body}</div><div class="dialog-actions"><button class="button button-quiet" data-action="close-dialog">Close preview</button></div>`);
  }

  function clearFilters() {
    $("#prospect-search").value = "";
    $("#status-filter").value = "all";
    $("#score-filter").value = "all";
    renderProspects();
    $("#prospect-search").focus();
  }

  function saveSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const senderEmail = $("#setting-sender-email");
    const address = $("#setting-address");
    address.setCustomValidity(senderEmail.value.trim() && !address.value.trim()
      ? "A physical mailing address is required before configuring real email outreach."
      : "");
    if (!form.reportValidity()) return;
    const limit = $("#setting-limit");
    const limitValue = limit.value.trim();
    if (limitValue && (!Number.isInteger(Number(limitValue)) || Number(limitValue) < 1 || Number(limitValue) > 100)) {
      limit.setCustomValidity("Enter a whole number from 1 to 100.");
      limit.reportValidity();
      return;
    }
    limit.setCustomValidity("");
    state.settings = Object.fromEntries(new FormData(form).entries());
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
    } catch {
      $("#settings-saved").textContent = "Could not save preferences in this browser.";
      return;
    }
    $("#settings-saved").textContent = "Preferences saved in this browser.";
    window.setTimeout(() => {
      if ($("#settings-saved")) $("#settings-saved").textContent = "";
    }, 3500);
  }

  function populateSettings() {
    for (const [key, value] of Object.entries(state.settings)) {
      const input = $(`#setting-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
      if (input) input.value = String(value ?? "");
    }
  }

  function handleAction(action) {
    const { action: name, id } = action.dataset;
    if (name === "add-prospect") openAddProspect();
    if (name === "details") openProspectDetails(id);
    if (name === "close-dialog") closeDialog();
    if (name === "export-csv") exportProspectsCsv();
    if (name === "preview-site") openSitePreview(id);
    if (name === "preview-discovery") openSimulationPreview("discovery");
    if (name === "preview-campaign") openSimulationPreview("campaign");
    if (name === "clear-filters") clearFilters();
    if (name === "retry-prospects") loadProspects();
    if (name === "close-nav") setNavigationExpanded(false, { restoreFocus: true });
  }

  document.addEventListener("click", (event) => {
    const navigation = event.target.closest("[data-view], [data-nav]");
    if (navigation) {
      const view = navigation.dataset.view || navigation.dataset.nav;
      if (view && Object.hasOwn(viewNames, view)) {
        event.preventDefault();
        navigate(view);
      }
      return;
    }
    const action = event.target.closest("[data-action]");
    if (action) handleAction(action);
  });

  $("#nav-toggle").addEventListener("click", () => {
    const isMobile = window.matchMedia("(max-width: 850px)").matches;
    if (isMobile) setNavigationExpanded(!$("#app-shell").classList.contains("mobile-nav-open"));
    else {
      const collapsed = $("#app-shell").classList.toggle("is-collapsed");
      $("#nav-toggle").setAttribute("aria-expanded", String(!collapsed));
      $("#nav-toggle").setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
    }
  });
  $("#nav-backdrop").addEventListener("click", () => setNavigationExpanded(false));
  $("#prospect-search").addEventListener("input", renderProspects);
  $("#status-filter").addEventListener("change", renderProspects);
  $("#score-filter").addEventListener("change", renderProspects);
  $("#settings-form").addEventListener("submit", saveSettings);
  $("#setting-limit").addEventListener("input", (event) => event.currentTarget.setCustomValidity(""));
  $("#setting-sender-email").addEventListener("input", () => $("#setting-address").setCustomValidity(""));
  $("#setting-address").addEventListener("input", (event) => event.currentTarget.setCustomValidity(""));
  $("#app-dialog").addEventListener("click", (event) => {
    if (event.target === $("#app-dialog")) closeDialog();
  });
  $("#app-dialog").addEventListener("close", () => {
    const focusTarget = $(".topbar-add");
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  });

  populateSettings();
  const initialView = window.location.hash.slice(1);
  navigate(Object.hasOwn(viewNames, initialView) ? initialView : "overview", { updateHash: false, focusHeading: false });
  window.addEventListener("hashchange", () => {
    const view = window.location.hash.slice(1);
    if (Object.hasOwn(viewNames, view)) navigate(view, { updateHash: false });
  });
  loadProspects();
})();
