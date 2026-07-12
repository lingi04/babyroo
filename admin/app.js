const GRAPH_VERSION = "v25.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const EVENT_THUMBNAILS = {
  "dikidiki-104109":
    "https://www.o2meet.io/data/dikidiki/1021/post/20260624/c574fa042fd946fca2f42e3aeee1fb03.jpg",
  "dikidiki-104108":
    "https://www.o2meet.io/data/dikidiki/1021/post/20260624/573c3f24906f4cca84d5be0e704104e6.jpg",
  "dikidiki-103871":
    "https://www.o2meet.io/data/dikidiki/1021/post/20260604/6ccfab7b1b204cf7b854053e473bd391.jpg",
  "dikidiki-103725":
    "https://www.o2meet.io/data/dikidiki/1021/post/20260215/a20fe054c76b4ba88eeb01147e5b0606.jpg",
};
const STORAGE_KEYS = {
  appId: "babyroo.admin.appId",
  accessToken: "babyroo.admin.accessToken",
  selectedAccount: "babyroo.admin.selectedAccount",
  candidates: "babyroo.admin.candidates",
};

const state = {
  accessToken: localStorage.getItem(STORAGE_KEYS.accessToken) || "",
  accounts: [],
  pageCount: 0,
  selectedAccount: readJson(STORAGE_KEYS.selectedAccount, null),
  results: [],
  candidates: readJson(STORAGE_KEYS.candidates, []),
  events: [],
  eventCsvPath: "",
};

const els = {
  pageTitle: document.querySelector("#pageTitle"),
  discoveryPage: document.querySelector("#discoveryPage"),
  eventsPage: document.querySelector("#eventsPage"),
  discoveryTabButton: document.querySelector("#discoveryTabButton"),
  eventsTabButton: document.querySelector("#eventsTabButton"),
  appIdInput: document.querySelector("#appIdInput"),
  redirectUriInput: document.querySelector("#redirectUriInput"),
  connectButton: document.querySelector("#connectButton"),
  clearAuthButton: document.querySelector("#clearAuthButton"),
  debugButton: document.querySelector("#debugButton"),
  useDirectInstagramButton: document.querySelector("#useDirectInstagramButton"),
  debugBox: document.querySelector("#debugBox"),
  debugPageIdInput: document.querySelector("#debugPageIdInput"),
  debugInstagramIdInput: document.querySelector("#debugInstagramIdInput"),
  tokenInput: document.querySelector("#tokenInput"),
  saveTokenButton: document.querySelector("#saveTokenButton"),
  connectionStatus: document.querySelector("#connectionStatus"),
  accountList: document.querySelector("#accountList"),
  hashtagInput: document.querySelector("#hashtagInput"),
  mediaModeInputs: [...document.querySelectorAll('input[name="mediaMode"]')],
  limitInput: document.querySelector("#limitInput"),
  searchButton: document.querySelector("#searchButton"),
  errorBox: document.querySelector("#errorBox"),
  resultMeta: document.querySelector("#resultMeta"),
  resultList: document.querySelector("#resultList"),
  candidateList: document.querySelector("#candidateList"),
  downloadButton: document.querySelector("#downloadButton"),
  refreshEventsButton: document.querySelector("#refreshEventsButton"),
  eventSearchInput: document.querySelector("#eventSearchInput"),
  eventCategoryFilter: document.querySelector("#eventCategoryFilter"),
  eventTagFilter: document.querySelector("#eventTagFilter"),
  eventReservationFilter: document.querySelector("#eventReservationFilter"),
  eventErrorBox: document.querySelector("#eventErrorBox"),
  eventMeta: document.querySelector("#eventMeta"),
  eventList: document.querySelector("#eventList"),
  eventDetailDialog: document.querySelector("#eventDetailDialog"),
  eventDetailEyebrow: document.querySelector("#eventDetailEyebrow"),
  eventDetailTitle: document.querySelector("#eventDetailTitle"),
  eventDetailThumb: document.querySelector("#eventDetailThumb"),
  eventDetailFacts: document.querySelector("#eventDetailFacts"),
  eventDetailSummary: document.querySelector("#eventDetailSummary"),
  eventDetailTags: document.querySelector("#eventDetailTags"),
  eventDetailRawFields: document.querySelector("#eventDetailRawFields"),
  closeEventDetailButton: document.querySelector("#closeEventDetailButton"),
  imagePreviewDialog: document.querySelector("#imagePreviewDialog"),
  imagePreviewTitle: document.querySelector("#imagePreviewTitle"),
  imagePreview: document.querySelector("#imagePreview"),
  closeImagePreviewButton: document.querySelector("#closeImagePreviewButton"),
  embeddedEventsCsv: document.querySelector("#embeddedEventsCsv"),
  accountTemplate: document.querySelector("#accountTemplate"),
  resultTemplate: document.querySelector("#resultTemplate"),
  candidateTemplate: document.querySelector("#candidateTemplate"),
  eventTemplate: document.querySelector("#eventTemplate"),
};

boot();

function boot() {
  els.appIdInput.value = localStorage.getItem(STORAGE_KEYS.appId) || "";
  els.redirectUriInput.value = defaultRedirectUri();
  els.hashtagInput.value = "아기랑갈만한곳";

  hydrateTokenFromHash();
  bindEvents();
  renderPage(currentPage());
  renderConnection();
  renderCandidates();
  loadEvents();

  if (state.accessToken) {
    loadConnectedAccounts();
  }
}

function defaultRedirectUri() {
  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return `${window.location.origin}/`;
  }
  return "https://babyroo.vercel.app/";
}

function bindEvents() {
  els.discoveryTabButton.addEventListener("click", () => navigateToPage("discovery"));
  els.eventsTabButton.addEventListener("click", () => navigateToPage("events"));
  els.connectButton.addEventListener("click", connectFacebook);
  els.clearAuthButton.addEventListener("click", clearConnection);
  els.debugButton.addEventListener("click", refreshDebugInfo);
  els.useDirectInstagramButton.addEventListener("click", useDirectInstagramAccount);
  els.saveTokenButton.addEventListener("click", usePastedToken);
  els.searchButton.addEventListener("click", searchHashtag);
  els.downloadButton.addEventListener("click", downloadCandidates);
  els.refreshEventsButton.addEventListener("click", loadEvents);
  els.eventSearchInput.addEventListener("input", renderEvents);
  els.eventCategoryFilter.addEventListener("change", renderEvents);
  els.eventTagFilter.addEventListener("change", renderEvents);
  els.eventReservationFilter.addEventListener("change", renderEvents);
  els.closeEventDetailButton.addEventListener("click", () => els.eventDetailDialog.close());
  els.eventDetailDialog.addEventListener("click", (event) => {
    if (event.target === els.eventDetailDialog) {
      els.eventDetailDialog.close();
    }
  });
  els.eventDetailThumb.addEventListener("click", openDetailThumbnailPreview);
  els.eventDetailThumb.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetailThumbnailPreview();
    }
  });
  els.closeImagePreviewButton.addEventListener("click", () => els.imagePreviewDialog.close());
  els.imagePreviewDialog.addEventListener("click", (event) => {
    if (event.target === els.imagePreviewDialog) {
      els.imagePreviewDialog.close();
    }
  });
  els.appIdInput.addEventListener("change", () => {
    localStorage.setItem(STORAGE_KEYS.appId, els.appIdInput.value.trim());
  });
  window.addEventListener("hashchange", () => renderPage(currentPage()));
}

function currentPage() {
  return window.location.hash === "#events" ? "events" : "discovery";
}

function navigateToPage(page) {
  window.location.hash = page === "events" ? "events" : "discovery";
  renderPage(page);
}

function renderPage(page) {
  const isEventsPage = page === "events";
  els.pageTitle.textContent = isEventsPage ? "Managed Events" : "Instagram Event Discovery";
  els.discoveryPage.classList.toggle("hidden", isEventsPage);
  els.eventsPage.classList.toggle("hidden", !isEventsPage);
  els.discoveryTabButton.classList.toggle("selected", !isEventsPage);
  els.eventsTabButton.classList.toggle("selected", isEventsPage);
}

function connectFacebook() {
  clearError();
  const appId = els.appIdInput.value.trim();
  const redirectUri = els.redirectUriInput.value.trim();
  if (!appId || !redirectUri) {
    showError("Facebook App ID and Redirect URL are required.");
    return;
  }
  localStorage.setItem(STORAGE_KEYS.appId, appId);

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "token",
    auth_type: "rerequest",
    return_scopes: "true",
    scope: [
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
    ].join(","),
  });
  window.location.href = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`;
}

function hydrateTokenFromHash() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = hash.get("access_token");
  if (!token) return;

  state.accessToken = token;
  localStorage.setItem(STORAGE_KEYS.accessToken, token);
  const grantedScopes = hash.get("granted_scopes");
  const deniedScopes = hash.get("denied_scopes");
  if (grantedScopes) {
    sessionStorage.setItem("babyroo.admin.grantedScopes", grantedScopes);
  }
  if (deniedScopes) {
    sessionStorage.setItem("babyroo.admin.deniedScopes", deniedScopes);
  }
  window.history.replaceState(null, document.title, window.location.pathname);
}

function usePastedToken() {
  const token = els.tokenInput.value.trim();
  if (!token) {
    showError("Paste a Graph API access token first.");
    return;
  }
  state.accessToken = token;
  localStorage.setItem(STORAGE_KEYS.accessToken, token);
  els.tokenInput.value = "";
  renderConnection();
  loadConnectedAccounts();
}

function clearConnection() {
  state.accessToken = "";
  state.accounts = [];
  state.pageCount = 0;
  state.selectedAccount = null;
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.selectedAccount);
  renderConnection();
  renderAccounts();
}

async function loadConnectedAccounts() {
  clearError();
  renderConnection("Loading accounts...");
  try {
    const payload = await fetchAccounts();
    state.accounts = (payload.data || [])
      .map((page) => ({
        pageId: page.id,
        pageName: page.name,
        instagram: page.instagram_business_account || page.connected_instagram_account || null,
      }))
      .filter((account) => account.instagram && account.instagram.id);
    state.pageCount = (payload.data || []).length;

    if (!state.selectedAccount && state.accounts.length) {
      selectAccount(state.accounts[0], { render: false });
    }
    renderConnection();
    renderAccounts();
  } catch (error) {
    renderConnection();
    showError(formatApiError(error));
  }
}

function fetchAccounts() {
  return graphGet("/me/accounts", {
    fields:
      "id,name,instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}",
    limit: 100,
  });
}

async function refreshDebugInfo() {
  clearError();
  if (!state.accessToken) {
    els.debugBox.textContent = "No access token. Connect first.";
    return;
  }

  const pageId = els.debugPageIdInput.value.trim();
  const instagramId = els.debugInstagramIdInput.value.trim();
  els.debugButton.disabled = true;
  els.debugBox.textContent = "Loading debug data...";
  try {
    const [
      me,
      permissions,
      accountsMinimal,
      accountsWithInstagram,
      directPage,
      directInstagram,
    ] = await Promise.all([
      graphProbe("/me", { fields: "id,name" }),
      graphProbe("/me/permissions", {}),
      graphProbe("/me/accounts", { fields: "id,name,tasks", limit: 100 }),
      graphProbe("/me/accounts", {
        fields:
          "id,name,tasks,instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}",
        limit: 100,
      }),
      pageId
        ? graphProbe(`/${pageId}`, {
            fields:
              "id,name,instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}",
          })
        : Promise.resolve(null),
      instagramId
        ? graphProbe(`/${instagramId}`, {
            fields: "id,username,profile_picture_url",
          })
        : Promise.resolve(null),
    ]);
    els.debugBox.textContent = JSON.stringify(
      {
        redirect_granted_scopes:
          sessionStorage.getItem("babyroo.admin.grantedScopes") || null,
        redirect_denied_scopes:
          sessionStorage.getItem("babyroo.admin.deniedScopes") || null,
        me,
        permissions,
        accounts_minimal: accountsMinimal,
        accounts_with_instagram: accountsWithInstagram,
        direct_page: directPage,
        direct_instagram: directInstagram,
      },
      null,
      2,
    );
  } catch (error) {
    els.debugBox.textContent = formatApiError(error);
  } finally {
    els.debugButton.disabled = false;
  }
}

async function useDirectInstagramAccount() {
  clearError();
  const instagramId = els.debugInstagramIdInput.value.trim();
  const pageId = els.debugPageIdInput.value.trim();
  if (!state.accessToken) {
    showError("Connect Facebook or paste a Graph API access token first.");
    return;
  }
  if (!instagramId) {
    showError("Enter an Instagram ID in Connection debug first.");
    return;
  }

  els.useDirectInstagramButton.disabled = true;
  try {
    const instagram = await graphGet(`/${instagramId}`, {
      fields: "id,username,profile_picture_url",
    });
    selectAccount({
      pageId: pageId || null,
      pageName: pageId ? `Facebook Page ${pageId}` : "Direct Instagram account",
      instagram,
    });
  } catch (error) {
    showError(formatApiError(error));
  } finally {
    els.useDirectInstagramButton.disabled = false;
  }
}

function selectAccount(account, options = { render: true }) {
  state.selectedAccount = account;
  localStorage.setItem(STORAGE_KEYS.selectedAccount, JSON.stringify(account));
  if (options.render) {
    renderConnection();
    renderAccounts();
  }
}

async function searchHashtag() {
  clearError();
  const tag = normalizeTag(els.hashtagInput.value);
  const mode = selectedMediaMode();
  const limit = clamp(parseInt(els.limitInput.value, 10) || 24, 1, 50);
  const igUserId = state.selectedAccount?.instagram?.id;

  if (!state.accessToken) {
    showError("Connect Facebook or paste a Graph API access token first.");
    return;
  }
  if (!igUserId) {
    showError("Select a connected Instagram Business or Creator account first.");
    return;
  }
  if (!tag) {
    showError("Enter a hashtag.");
    return;
  }

  els.searchButton.disabled = true;
  els.resultMeta.textContent = "Searching...";
  els.resultList.className = "result-list empty";
  els.resultList.textContent = "Waiting for API response.";

  try {
    const hashtagPayload = await graphGet("/ig_hashtag_search", {
      user_id: igUserId,
      q: tag,
    });
    const hashtag = hashtagPayload.data?.[0];
    if (!hashtag?.id) {
      throw new Error(`No hashtag id found for #${tag}.`);
    }

    const mediaPayload = await graphGet(`/${hashtag.id}/${mode}_media`, {
      user_id: igUserId,
      fields: "id,caption,media_type,media_url,permalink,timestamp",
      limit,
    });

    state.results = (mediaPayload.data || []).map((item) => ({
      ...item,
      hashtag: tag,
      hashtag_id: hashtag.id,
      ig_user_id: igUserId,
      search_mode: mode,
    }));
    renderResults(tag, hashtag.id, mode);
  } catch (error) {
    els.resultMeta.textContent = "";
    els.resultList.className = "result-list empty";
    els.resultList.textContent = "No API results yet.";
    showError(formatApiError(error));
  } finally {
    els.searchButton.disabled = false;
  }
}

async function graphGet(path, params = {}) {
  const url = new URL(`${GRAPH_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("access_token", state.accessToken);

  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || payload.error) {
    const error = new Error(payload.error?.message || `Graph API failed: ${response.status}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function graphProbe(path, params = {}) {
  try {
    return await graphGet(path, params);
  } catch (error) {
    return error.payload || { error: { message: error.message || String(error) } };
  }
}

function renderConnection(message) {
  if (message) {
    els.connectionStatus.textContent = message;
    els.connectionStatus.classList.remove("connected");
    return;
  }
  if (state.selectedAccount?.instagram?.username) {
    els.connectionStatus.textContent = "Connected";
    els.connectionStatus.classList.add("connected");
  } else if (state.accessToken) {
    els.connectionStatus.textContent = "Token saved";
    els.connectionStatus.classList.remove("connected");
  } else {
    els.connectionStatus.textContent = "Not connected";
    els.connectionStatus.classList.remove("connected");
  }
}

function renderAccounts() {
  els.accountList.innerHTML = "";
  if (!state.accounts.length) {
    els.accountList.className = "account-list empty";
    if (!state.accessToken) {
      els.accountList.textContent = "No connected account loaded.";
      return;
    }

    els.accountList.textContent = state.pageCount
      ? `No connected Instagram Business or Creator account found. Loaded ${state.pageCount} Facebook Page(s).`
      : "No Facebook Pages are visible to this token. Check Page selection, Page access, and granted permissions in Connection debug.";
    return;
  }

  els.accountList.className = "account-list";
  state.accounts.forEach((account) => {
    const node = els.accountTemplate.content.firstElementChild.cloneNode(true);
    const selected = account.instagram.id === state.selectedAccount?.instagram?.id;
    node.classList.toggle("selected", selected);
    node.querySelector("strong").textContent = `@${account.instagram.username}`;
    node.querySelector("span").textContent = `${account.pageName} · IG user ${account.instagram.id}`;
    node.addEventListener("click", () => selectAccount(account));
    els.accountList.appendChild(node);
  });
}

function renderResults(tag, hashtagId, mode) {
  els.resultMeta.textContent = `#${tag} · ${mode} · hashtag id ${hashtagId} · ${state.results.length} media`;
  els.resultList.innerHTML = "";

  if (!state.results.length) {
    els.resultList.className = "result-list empty";
    els.resultList.textContent = "The API returned no media.";
    return;
  }

  els.resultList.className = "result-list";
  state.results.forEach((item) => {
    const node = els.resultTemplate.content.firstElementChild.cloneNode(true);
    const title = inferTitle(item.caption, item.id);
    const thumb = node.querySelector(".media-thumb");
    if (item.media_url && item.media_type !== "VIDEO") {
      thumb.style.backgroundImage = `url("${item.media_url}")`;
    }
    node.querySelector("h3").textContent = title;
    node.querySelector(".result-title-row span").textContent = item.media_type || "MEDIA";
    node.querySelector("p").textContent = item.caption || "No caption";
    node.querySelector("a").href = item.permalink || "#";
    node.querySelector("button").addEventListener("click", () => saveCandidate(item));
    els.resultList.appendChild(node);
  });
}

function saveCandidate(item) {
  const candidate = {
    id: `instagram-${item.id}`,
    title: inferTitle(item.caption, item.id),
    source: "instagram_graph_hashtag",
    source_event_id: item.id,
    source_url: item.permalink,
    source_hashtag: item.hashtag,
    source_search_mode: item.search_mode,
    captured_at: new Date().toISOString(),
    status: "candidate",
    payload: {
      caption: item.caption || null,
      media_type: item.media_type || null,
      media_url: item.media_url || null,
      permalink: item.permalink || null,
      posted_at: item.timestamp || null,
      username: item.username || null,
      hashtag_id: item.hashtag_id,
      ig_user_id: item.ig_user_id,
      search_mode: item.search_mode,
    },
  };

  state.candidates = [
    candidate,
    ...state.candidates.filter((existing) => existing.id !== candidate.id),
  ];
  localStorage.setItem(STORAGE_KEYS.candidates, JSON.stringify(state.candidates));
  renderCandidates();
}

function renderCandidates() {
  els.candidateList.innerHTML = "";
  if (!state.candidates.length) {
    els.candidateList.className = "candidate-list empty";
    els.candidateList.textContent = "No saved candidates yet.";
    return;
  }

  els.candidateList.className = "candidate-list";
  state.candidates.forEach((candidate) => {
    const node = els.candidateTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = candidate.title;
    node.querySelector("p").textContent = candidate.source_url || "No URL";
    node.querySelector("button").addEventListener("click", () => removeCandidate(candidate.id));
    els.candidateList.appendChild(node);
  });
}

function loadEvents() {
  clearEventError();
  els.refreshEventsButton.disabled = true;
  els.eventMeta.textContent = "Loading embedded events.csv...";
  els.eventList.className = "event-list empty";
  els.eventList.textContent = "No events loaded yet.";

  try {
    const csvText = els.embeddedEventsCsv?.textContent || "";
    if (!csvText.trim()) {
      throw new Error("Embedded events.csv is empty.");
    }
    state.events = parseCsv(csvText.trim());
    state.eventCsvPath = "embedded events.csv";
    populateEventFilters();
    renderEvents();
  } catch (error) {
    state.events = [];
    state.eventCsvPath = "";
    els.eventMeta.textContent = "";
    showEventError(`Could not load embedded events.csv. ${error.message || String(error)}`);
  } finally {
    els.refreshEventsButton.disabled = false;
  }
}

function populateEventFilters() {
  populateEventCategoryFilter();
  populateEventTagFilter();
}

function populateEventCategoryFilter() {
  const selected = els.eventCategoryFilter.value;
  const categories = [...new Set(state.events.map((event) => event.category).filter(Boolean))].sort();
  els.eventCategoryFilter.innerHTML = '<option value="">All categories</option>';
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.eventCategoryFilter.appendChild(option);
  });
  els.eventCategoryFilter.value = categories.includes(selected) ? selected : "";
}

function populateEventTagFilter() {
  const selected = els.eventTagFilter.value;
  const tags = [
    ...new Set(state.events.flatMap((event) => parseTags(event.tags))),
  ].sort((left, right) => left.localeCompare(right, "ko"));
  els.eventTagFilter.innerHTML = '<option value="">All tags</option>';
  tags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    els.eventTagFilter.appendChild(option);
  });
  els.eventTagFilter.value = tags.includes(selected) ? selected : "";
}

function renderEvents() {
  const query = els.eventSearchInput.value.trim().toLocaleLowerCase();
  const category = els.eventCategoryFilter.value;
  const tag = els.eventTagFilter.value;
  const reservation = els.eventReservationFilter.value;
  const events = state.events
    .filter((event) => {
      const matchesQuery = !query || eventSearchText(event).includes(query);
      const matchesCategory = !category || event.category === category;
      const matchesTag = !tag || parseTags(event.tags).includes(tag);
      const matchesReservation = !reservation || event.reservation_status === reservation;
      return matchesQuery && matchesCategory && matchesTag && matchesReservation;
    })
    .sort((left, right) => right.csvRowIndex - left.csvRowIndex);

  els.eventMeta.textContent = `${events.length} of ${state.events.length} events · newest additions first · ${state.eventCsvPath || "events.csv"}`;
  els.eventList.innerHTML = "";

  if (!events.length) {
    els.eventList.className = "event-list empty";
    els.eventList.textContent = state.events.length ? "No events match the filters." : "No events loaded yet.";
    return;
  }

  els.eventList.className = "event-list";
  events.forEach((event) => {
    const node = els.eventTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.sequence = String(event.csvRowIndex + 1);
    renderEventThumbnail(node.querySelector(".event-thumb"), event);
    node.querySelector("h3").textContent = event.title || event.id || "Untitled event";
    node.querySelector(".event-title-row span").textContent = eventStatusLabel(event);
    node.querySelector("p").textContent = event.summary || "No summary";
    renderTagBadges(node.querySelector(".event-card-tags"), event.tags, {
      clickable: true,
      limit: 6,
    });
    node.querySelector('[data-field="date"]').textContent = formatDateRange(
      event.starts_at,
      event.ends_at,
    );
    node.querySelector('[data-field="age"]').textContent = formatAgeRange(
      event.age_min_months,
      event.age_max_months,
    );
    node.querySelector('[data-field="venue"]').textContent = [event.venue_name, event.address]
      .filter(Boolean)
      .join(" · ") || "No venue";
    node.querySelector('[data-field="price"]').textContent =
      event.price_text || event.price_type || "No price";
    node.querySelector('[data-field="source"]').textContent = event.source || "unknown source";
    const link = node.querySelector("a");
    link.href = event.source_url || "#";
    link.toggleAttribute("hidden", !event.source_url);
    node.addEventListener("click", (domEvent) => {
      if (domEvent.target.closest("a")) return;
      openEventDetail(event);
    });
    node.addEventListener("keydown", (domEvent) => {
      if (domEvent.key === "Enter" || domEvent.key === " ") {
        domEvent.preventDefault();
        openEventDetail(event);
      }
    });
    els.eventList.appendChild(node);
  });
}

function renderEventThumbnail(container, event) {
  const url = EVENT_THUMBNAILS[event.id] || "";
  container.style.backgroundImage = "";
  container.textContent = "";
  container.dataset.fullImageUrl = "";
  container.tabIndex = -1;
  container.removeAttribute("role");
  container.removeAttribute("title");

  if (url) {
    container.classList.remove("fallback");
    container.style.backgroundImage = `url("${url}")`;
    container.dataset.fullImageUrl = url;
    container.setAttribute("aria-label", `${event.title || "Event"} thumbnail`);
    return;
  }

  container.classList.add("fallback");
  container.textContent = thumbnailLabel(event);
  container.setAttribute("aria-label", `${event.source || event.category || "Event"} thumbnail`);
}

function enableDetailThumbnailPreview(event) {
  const url = EVENT_THUMBNAILS[event.id] || "";
  if (!url) return;

  els.eventDetailThumb.tabIndex = 0;
  els.eventDetailThumb.setAttribute("role", "button");
  els.eventDetailThumb.title = "Open original image";
  els.eventDetailThumb.dataset.previewTitle = event.title || "Event image";
}

function openDetailThumbnailPreview() {
  const url = els.eventDetailThumb.dataset.fullImageUrl;
  if (!url) return;

  els.imagePreview.src = url;
  els.imagePreview.alt = els.eventDetailThumb.dataset.previewTitle || "Event image";
  els.imagePreviewTitle.textContent = els.imagePreview.alt;

  if (typeof els.imagePreviewDialog.showModal === "function") {
    els.imagePreviewDialog.showModal();
  } else {
    els.imagePreviewDialog.setAttribute("open", "");
  }
}

function thumbnailLabel(event) {
  if (event.source === "seoul_culture") return "서울";
  if (event.source === "dikidiki") return "DDP";
  return (event.category || event.source || "Event").slice(0, 3).toUpperCase();
}

function openEventDetail(event) {
  els.eventDetailEyebrow.textContent = [event.source, event.source_event_id]
    .filter(Boolean)
    .join(" · ");
  els.eventDetailTitle.textContent = event.title || event.id || "Untitled event";
  renderEventThumbnail(els.eventDetailThumb, event);
  enableDetailThumbnailPreview(event);
  els.eventDetailSummary.textContent = event.summary || "No summary";
  renderDetailFacts(event);
  renderDetailTags(event.tags);
  renderRawFields(event);

  if (typeof els.eventDetailDialog.showModal === "function") {
    els.eventDetailDialog.showModal();
  } else {
    els.eventDetailDialog.setAttribute("open", "");
  }
}

function renderDetailFacts(event) {
  const facts = [
    ["ID", event.id],
    ["Date", formatDateRange(event.starts_at, event.ends_at)],
    ["Age", formatAgeRange(event.age_min_months, event.age_max_months)],
    ["Venue", event.venue_name],
    ["Address", event.address],
    ["Region", [event.region, event.locality].filter(Boolean).join(" ")],
    ["Category", event.category],
    ["Price", event.price_text || event.price_type],
    ["Reservation", formatBooleanStatus(event.reservation_required, event.reservation_status)],
    ["Guardian", formatBoolean(event.guardian_required)],
    ["Indoor", formatBoolean(event.indoor)],
    ["Last checked", event.last_checked_at],
  ];

  els.eventDetailFacts.innerHTML = "";
  facts.forEach(([label, value]) => {
    appendDefinition(els.eventDetailFacts, label, value || "Not set");
  });
}

function renderDetailTags(value) {
  els.eventDetailTags.innerHTML = "";
  const tags = parseTags(value);
  if (!tags.length) {
    els.eventDetailTags.className = "tag-list empty";
    els.eventDetailTags.textContent = "No tags";
    return;
  }

  els.eventDetailTags.className = "tag-list";
  tags.forEach((tag) => {
    const item = document.createElement("span");
    item.textContent = tag;
    els.eventDetailTags.appendChild(item);
  });
}

function renderTagBadges(container, value, options = {}) {
  container.innerHTML = "";
  const tags = parseTags(value);
  if (!tags.length) {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");
  const limit = options.limit || tags.length;
  tags.slice(0, limit).forEach((tag) => {
    const item = document.createElement("span");
    item.textContent = tag;
    if (options.clickable) {
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.title = `Filter by ${tag}`;
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        selectEventTag(tag);
      });
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          selectEventTag(tag);
        }
      });
    }
    container.appendChild(item);
  });
  if (tags.length > limit) {
    const more = document.createElement("span");
    more.textContent = `+${tags.length - limit}`;
    more.className = "muted-badge";
    container.appendChild(more);
  }
}

function selectEventTag(tag) {
  els.eventTagFilter.value = tag;
  renderEvents();
}

function parseTags(value) {
  return (value || "").split("|").map((tag) => tag.trim()).filter(Boolean);
}

function renderRawFields(event) {
  els.eventDetailRawFields.innerHTML = "";
  Object.entries(event).forEach(([key, value]) => {
    appendDefinition(els.eventDetailRawFields, key, value || "");
  });
}

function appendDefinition(list, term, description) {
  const item = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = description;
  item.append(dt, dd);
  list.appendChild(item);
}

function formatBooleanStatus(required, status) {
  const requiredText = formatBoolean(required);
  return [requiredText, status].filter(Boolean).join(" · ");
}

function formatBoolean(value) {
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  return value || "Not set";
}

function eventSearchText(event) {
  return [
    event.title,
    event.summary,
    event.venue_name,
    event.address,
    event.region,
    event.locality,
    event.category,
    event.source,
    event.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function eventStatusLabel(event) {
  const parts = [event.category, event.reservation_status].filter(Boolean);
  return parts.length ? parts.join(" · ") : "event";
}

function formatDateRange(start, end) {
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end || "No date";
}

function formatAgeRange(min, max) {
  if (min && max) return `${min}-${max} months`;
  if (min) return `${min}+ months`;
  if (max) return `Up to ${max} months`;
  return "No age";
}

function parseCsv(text) {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ""));
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).filter((row) => row.some(Boolean)).map((row, rowIndex) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });
    Object.defineProperty(record, "csvRowIndex", {
      value: rowIndex,
      enumerable: false,
    });
    return record;
  });
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function removeCandidate(id) {
  state.candidates = state.candidates.filter((candidate) => candidate.id !== id);
  localStorage.setItem(STORAGE_KEYS.candidates, JSON.stringify(state.candidates));
  renderCandidates();
}

function downloadCandidates() {
  const payload = {
    generated_at: new Date().toISOString(),
    count: state.candidates.length,
    candidates: state.candidates,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "babyroo-event-candidates.json";
  link.click();
  URL.revokeObjectURL(url);
}

function inferTitle(caption, fallback) {
  const text = caption || "";
  const line = text
    .split("\n")
    .map((value) => value.trim())
    .find((value) => value && !value.startsWith("#"));
  return line ? line.slice(0, 80) : `Instagram media ${fallback}`;
}

function normalizeTag(value) {
  return value.trim().replace(/^#/, "").trim();
}

function selectedMediaMode() {
  return els.mediaModeInputs.find((input) => input.checked)?.value === "top"
    ? "top"
    : "recent";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function clearError() {
  els.errorBox.classList.add("hidden");
  els.errorBox.textContent = "";
}

function showError(message) {
  els.errorBox.textContent = message;
  els.errorBox.classList.remove("hidden");
}

function clearEventError() {
  els.eventErrorBox.classList.add("hidden");
  els.eventErrorBox.textContent = "";
}

function showEventError(message) {
  els.eventErrorBox.textContent = message;
  els.eventErrorBox.classList.remove("hidden");
}

function formatApiError(error) {
  if (error.payload) {
    return JSON.stringify(error.payload, null, 2);
  }
  return error.message || String(error);
}
