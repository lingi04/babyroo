const GRAPH_VERSION = "v25.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
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
};

const els = {
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
  limitInput: document.querySelector("#limitInput"),
  searchButton: document.querySelector("#searchButton"),
  errorBox: document.querySelector("#errorBox"),
  resultMeta: document.querySelector("#resultMeta"),
  resultList: document.querySelector("#resultList"),
  candidateList: document.querySelector("#candidateList"),
  downloadButton: document.querySelector("#downloadButton"),
  accountTemplate: document.querySelector("#accountTemplate"),
  resultTemplate: document.querySelector("#resultTemplate"),
  candidateTemplate: document.querySelector("#candidateTemplate"),
};

boot();

function boot() {
  els.appIdInput.value = localStorage.getItem(STORAGE_KEYS.appId) || "";
  els.redirectUriInput.value = defaultRedirectUri();
  els.hashtagInput.value = "아기랑갈만한곳";

  hydrateTokenFromHash();
  bindEvents();
  renderConnection();
  renderCandidates();

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
  els.connectButton.addEventListener("click", connectFacebook);
  els.clearAuthButton.addEventListener("click", clearConnection);
  els.debugButton.addEventListener("click", refreshDebugInfo);
  els.useDirectInstagramButton.addEventListener("click", useDirectInstagramAccount);
  els.saveTokenButton.addEventListener("click", usePastedToken);
  els.searchButton.addEventListener("click", searchHashtag);
  els.downloadButton.addEventListener("click", downloadCandidates);
  els.appIdInput.addEventListener("change", () => {
    localStorage.setItem(STORAGE_KEYS.appId, els.appIdInput.value.trim());
  });
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
              "id,name,access_token,instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}",
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

    const mediaPayload = await graphGet(`/${hashtag.id}/recent_media`, {
      user_id: igUserId,
      fields: "id,caption,media_type,media_url,permalink,timestamp,username",
      limit,
    });

    state.results = (mediaPayload.data || []).map((item) => ({
      ...item,
      hashtag: tag,
      hashtag_id: hashtag.id,
      ig_user_id: igUserId,
    }));
    renderResults(tag, hashtag.id);
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

function renderResults(tag, hashtagId) {
  els.resultMeta.textContent = `#${tag} · hashtag id ${hashtagId} · ${state.results.length} media`;
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

function formatApiError(error) {
  if (error.payload) {
    return JSON.stringify(error.payload, null, 2);
  }
  return error.message || String(error);
}
