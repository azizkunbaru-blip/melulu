/**
 * MELULU Frontend
 * - Default uses BACKEND_PROXY to avoid CORS & hide API key
 * - If you don’t use backend, set USE_PROXY=false and set BASE_URL directly to your API origin
 */

const USE_PROXY = true;

// If USE_PROXY=true => calls backend endpoints: /api/home, /api/search?q=, /api/detail/:id, /api/video/:id
const BACKEND_PROXY = "http://localhost:8787";

// If USE_PROXY=false => calls direct API: e.g. https://your-api.com/api/v1
const BASE_URL = "https://YOUR_API_ORIGIN_HERE"; // only used when USE_PROXY=false

// API paths (Melolo-like)
const PATHS = {
  home: "/api/v1/home",
  search: "/api/v1/search",
  detail: "/api/v1/detail", // + /:id
  video: "/api/v1/video",   // + /:id
};

// UI Elements
const grid = document.getElementById("grid");
const q = document.getElementById("q");
const btnSearch = document.getElementById("btnSearch");
const btnHome = document.getElementById("btnHome");
const btnRefresh = document.getElementById("btnRefresh");
const btnLoadMore = document.getElementById("btnLoadMore");
const pillStatus = document.getElementById("pillStatus");
const metaInfo = document.getElementById("metaInfo");
const gridTitle = document.getElementById("gridTitle");
const year = document.getElementById("year");
year.textContent = new Date().getFullYear();

// Drawer
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const btnCloseDrawer = document.getElementById("btnCloseDrawer");
const dTitle = document.getElementById("dTitle");
const dMeta = document.getElementById("dMeta");
const dPoster = document.getElementById("dPoster");
const dRating = document.getElementById("dRating");
const dTags = document.getElementById("dTags");
const dDesc = document.getElementById("dDesc");
const btnPlay = document.getElementById("btnPlay");
const btnCopyLink = document.getElementById("btnCopyLink");

// Player modal
const player = document.getElementById("player");
const playerOverlay = document.getElementById("playerOverlay");
const btnClosePlayer = document.getElementById("btnClosePlayer");
const btnTheater = document.getElementById("btnTheater");
const videoWrap = document.getElementById("videoWrap");
const video = document.getElementById("video");
const pTitle = document.getElementById("pTitle");
const pMeta = document.getElementById("pMeta");

// Chips
const chips = document.getElementById("chips");
const CHIP_PRESETS = ["Trending", "Romance", "Comedy", "Action", "CEO", "Revenge", "校园", "甜宠"];

let state = {
  mode: "home", // home | search
  page: 1,
  query: "",
  items: [],
  selected: null, // detail object
  selectedVideoUrl: null,
};

// -------- Helpers --------
function setStatus(text, kind = "ok") {
  pillStatus.textContent = text;
  pillStatus.style.borderColor =
    kind === "err" ? "rgba(251,113,133,.35)" :
    kind === "warn" ? "rgba(96,165,250,.25)" :
    "rgba(255,255,255,.10)";
  pillStatus.style.background =
    kind === "err" ? "rgba(251,113,133,.10)" :
    kind === "warn" ? "rgba(96,165,250,.10)" :
    "rgba(255,255,255,.03)";
}

function apiUrl(path) {
  if (USE_PROXY) return `${BACKEND_PROXY}${path}`;
  return `${BASE_URL}${path}`;
}

async function getJSON(url) {
  setStatus("Loading…", "warn");
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  setStatus("OK");
  return data;
}

/**
 * Normalize data from your API into common shape:
 * item: { id, title, poster, tag, views, year, duration }
 *
 * EDIT THIS FUNCTION to match your real API response keys.
 */
function normalizeList(raw) {
  // Accept raw in various styles:
  // { data: [ ... ] } or { list: [ ... ] } or [ ... ]
  const arr = Array.isArray(raw) ? raw : (raw?.data || raw?.list || raw?.items || []);
  return arr.map((it) => ({
    id: String(it.id ?? it.video_id ?? it.mid ?? it._id ?? ""),
    title: it.title ?? it.name ?? it.vod_name ?? "Untitled",
    poster: it.poster ?? it.cover ?? it.pic ?? it.vod_pic ?? "",
    tag: it.tag ?? it.category ?? it.type ?? it.vod_class ?? "—",
    views: it.views ?? it.play ?? it.hot ?? it.vod_hits ?? 0,
    year: it.year ?? it.release_year ?? it.vod_year ?? "",
    duration: it.duration ?? it.len ?? it.vod_duration ?? "",
  })).filter(x => x.id);
}

/**
 * Normalize detail:
 * detail: { id, title, poster, tags[], rating, desc, year, views }
 */
function normalizeDetail(raw) {
  const d = raw?.data ?? raw?.detail ?? raw ?? {};
  const tags =
    Array.isArray(d.tags) ? d.tags :
    typeof d.tags === "string" ? d.tags.split(/[,，]/).map(s => s.trim()).filter(Boolean) :
    typeof d.vod_class === "string" ? d.vod_class.split(/[,，]/).map(s => s.trim()).filter(Boolean) :
    [];

  return {
    id: String(d.id ?? d.video_id ?? d.mid ?? d._id ?? ""),
    title: d.title ?? d.name ?? d.vod_name ?? "Untitled",
    poster: d.poster ?? d.cover ?? d.pic ?? d.vod_pic ?? "",
    tags,
    rating: d.rating ?? d.score ?? d.vod_score ?? "—",
    desc: d.desc ?? d.description ?? d.vod_content ?? "—",
    year: d.year ?? d.vod_year ?? "",
    views: d.views ?? d.vod_hits ?? "",
  };
}

/**
 * Normalize video url:
 * { url: "https://..." } or { data: { url } } etc
 */
function normalizeVideo(raw) {
  const d = raw?.data ?? raw ?? {};
  return d.url ?? d.play_url ?? d.m3u8 ?? d.mp4 ?? "";
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[m]));
}

function formatViews(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v ?? "");
  if (n >= 1e9) return (n/1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n/1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n/1e3).toFixed(1) + "K";
  return String(n);
}

// -------- Rendering --------
function renderGrid(items, append = false) {
  const html = items.map(it => `
    <article class="card-item" data-id="${escapeHTML(it.id)}">
      <div class="card-thumb">
        ${it.poster ? `<img src="${escapeHTML(it.poster)}" alt="${escapeHTML(it.title)}" loading="lazy">` : ``}
        <div class="corner">${escapeHTML(it.tag || "—")}</div>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHTML(it.title)}</div>
        <div class="card-meta">
          <span class="tagline">${escapeHTML(it.year || "—")}${it.duration ? " • " + escapeHTML(it.duration) : ""}</span>
          <span>${escapeHTML(formatViews(it.views))} ▶</span>
        </div>
      </div>
    </article>
  `).join("");

  if (append) grid.insertAdjacentHTML("beforeend", html);
  else grid.innerHTML = html;

  metaInfo.textContent = `${items.length} item${items.length === 1 ? "" : "s"} ditampilkan`;
}

function renderChips() {
  chips.innerHTML = CHIP_PRESETS.map((c) => `
    <button class="chip" data-chip="${escapeHTML(c)}">${escapeHTML(c)}</button>
  `).join("");
}

function openDrawer(detail) {
  state.selected = detail;
  dTitle.textContent = detail.title;
  dMeta.textContent = `${detail.year || "—"} • ${detail.views ? `${formatViews(detail.views)} views` : "—"}`;
  dPoster.src = detail.poster || "";
  dRating.textContent = String(detail.rating ?? "—");
  dTags.textContent = detail.tags?.length ? detail.tags.join(" • ") : "—";
  dDesc.textContent = (detail.desc || "—").replace(/<[^>]+>/g, "").trim();

  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
}

function openPlayer({ title, meta, url }) {
  pTitle.textContent = title || "Playing";
  pMeta.textContent = meta || "";
  player.classList.add("open");
  player.setAttribute("aria-hidden", "false");

  // Stop previous
  try { video.pause(); } catch {}
  video.removeAttribute("src");
  video.load();

  // Simple: direct mp4 should work
  // If HLS (.m3u8), attempt native or fallback message
  if (url.endsWith(".m3u8")) {
    // Safari supports native HLS; Chrome/Firefox need hls.js (not bundled here).
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play().catch(()=>{});
    } else {
      // fallback: open new tab
      setStatus("HLS detected — open in new tab (or add hls.js)", "warn");
      window.open(url, "_blank", "noopener,noreferrer");
      closePlayer();
      return;
    }
  } else {
    video.src = url;
    video.play().catch(()=>{});
  }
}

function closePlayer() {
  player.classList.remove("open");
  player.setAttribute("aria-hidden", "true");
  try { video.pause(); } catch {}
}

// -------- API Actions --------
async function loadHome(reset = true) {
  if (reset) {
    state.mode = "home";
    state.page = 1;
    state.items = [];
    gridTitle.textContent = "Trending / Home";
  }

  const url = USE_PROXY
    ? apiUrl(`/api/home?page=${state.page}`)
    : apiUrl(`${PATHS.home}?page=${state.page}`);

  const raw = await getJSON(url);
  const items = normalizeList(raw);

  state.items = reset ? items : state.items.concat(items);
  renderGrid(items, !reset);
}

async function search(query, reset = true) {
  if (reset) {
    state.mode = "search";
    state.page = 1;
    state.query = query;
    state.items = [];
    gridTitle.textContent = `Search: “${query}”`;
  }

  const url = USE_PROXY
    ? apiUrl(`/api/search?q=${encodeURIComponent(query)}&page=${state.page}`)
    : apiUrl(`${PATHS.search}?q=${encodeURIComponent(query)}&page=${state.page}`);

  const raw = await getJSON(url);
  const items = normalizeList(raw);

  state.items = reset ? items : state.items.concat(items);
  renderGrid(items, !reset);
}

async function fetchDetail(id) {
  const url = USE_PROXY
    ? apiUrl(`/api/detail/${encodeURIComponent(id)}`)
    : apiUrl(`${PATHS.detail}/${encodeURIComponent(id)}`);

  const raw = await getJSON(url);
  return normalizeDetail(raw);
}

async function fetchVideoUrl(id) {
  const url = USE_PROXY
    ? apiUrl(`/api/video/${encodeURIComponent(id)}`)
    : apiUrl(`${PATHS.video}/${encodeURIComponent(id)}`);

  const raw = await getJSON(url);
  return normalizeVideo(raw);
}

// -------- Events --------
renderChips();

chips.addEventListener("click", async (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  const chip = btn.getAttribute("data-chip") || "";
  q.value = chip === "Trending" ? "" : chip;

  document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");

  try {
    if (chip === "Trending") await loadHome(true);
    else await search(chip, true);
  } catch (err) {
    console.error(err);
    setStatus("Error", "err");
    metaInfo.textContent = err.message;
  }
});

btnSearch.addEventListener("click", async () => {
  const query = q.value.trim();
  try {
    if (!query) await loadHome(true);
    else await search(query, true);
  } catch (err) {
    console.error(err);
    setStatus("Error", "err");
    metaInfo.textContent = err.message;
  }
});

q.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnSearch.click();
});

btnHome.addEventListener("click", async () => {
  q.value = "";
  document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
  try { await loadHome(true); } catch (err) { setStatus("Error", "err"); metaInfo.textContent = err.message; }
});

btnRefresh.addEventListener("click", async () => {
  try {
    if (state.mode === "home") await loadHome(true);
    else await search(state.query, true);
  } catch (err) { setStatus("Error", "err"); metaInfo.textContent = err.message; }
});

btnLoadMore.addEventListener("click", async () => {
  try {
    state.page += 1;
    if (state.mode === "home") await loadHome(false);
    else await search(state.query, false);
  } catch (err) { setStatus("Error", "err"); metaInfo.textContent = err.message; }
});

grid.addEventListener("click", async (e) => {
  const card = e.target.closest(".card-item");
  if (!card) return;
  const id = card.getAttribute("data-id");
  if (!id) return;

  try {
    const detail = await fetchDetail(id);
    openDrawer(detail);
  } catch (err) {
    console.error(err);
    setStatus("Error", "err");
    metaInfo.textContent = err.message;
  }
});

drawerOverlay.addEventListener("click", closeDrawer);
btnCloseDrawer.addEventListener("click", closeDrawer);

btnCopyLink.addEventListener("click", async () => {
  if (!state.selected?.id) return;
  const deepLink = `${location.origin}${location.pathname}#id=${encodeURIComponent(state.selected.id)}`;
  try {
    await navigator.clipboard.writeText(deepLink);
    setStatus("Link copied");
  } catch {
    setStatus("Gagal copy", "err");
  }
});

btnPlay.addEventListener("click", async () => {
  if (!state.selected?.id) return;
  try {
    const url = await fetchVideoUrl(state.selected.id);
    if (!url) throw new Error("Video URL kosong dari API.");
    closeDrawer();
    openPlayer({
      title: state.selected.title,
      meta: `${state.selected.year || "—"} • ${state.selected.tags?.slice(0,3).join(" • ") || "—"}`,
      url
    });
  } catch (err) {
    console.error(err);
    setStatus("Play error", "err");
    metaInfo.textContent = err.message;
  }
});

playerOverlay.addEventListener("click", closePlayer);
btnClosePlayer.addEventListener("click", closePlayer);

btnTheater.addEventListener("click", () => {
  videoWrap.classList.toggle("theater");
});

// Deep link open by hash: #id=123
async function bootFromHash() {
  const m = location.hash.match(/id=([^&]+)/);
  if (!m) return;
  const id = decodeURIComponent(m[1]);
  try {
    const detail = await fetchDetail(id);
    openDrawer(detail);
  } catch (err) {
    console.error(err);
    setStatus("Error", "err");
    metaInfo.textContent = err.message;
  }
}

// Boot
(async function init(){
  try {
    await loadHome(true);
    await bootFromHash();
    setStatus(USE_PROXY ? "Proxy mode" : "Direct mode");
  } catch (err) {
    console.error(err);
    setStatus("Error", "err");
    metaInfo.textContent = err.message;
  }
})();
