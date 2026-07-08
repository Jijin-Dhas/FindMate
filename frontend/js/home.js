
  const API   = "http://localhost:5000/api";
  const IMG   = "http://localhost:5000";
  const TOKEN = localStorage.getItem("findmate_token");

  /* ── Auth guard ─────────────────────────────────────── */
  if (!TOKEN) window.location.replace("./login.html");

  /* ── Populate user info ──────────────────────────────── */
  let currentUser = null;
  try { currentUser = JSON.parse(localStorage.getItem("findmate_user")); } catch {}

  if (currentUser) {
    const first   = (currentUser.name || "").split(" ")[0] || "there";
    const initial = first.charAt(0).toUpperCase();

    document.getElementById("userName").textContent      = first;
    document.getElementById("sidebarName").textContent   = currentUser.name  || first;
    document.getElementById("sidebarEmail").textContent  = currentUser.email || "—";
    document.getElementById("sidebarAvatar").textContent = initial;

    /* Profile completion — rough heuristic */
    const fields = ["name","email","phone","city","occupation","gender","bio"];
    const filled  = fields.filter(f => currentUser[f]).length;
    const pct     = Math.round((filled / fields.length) * 100);
    document.getElementById("profilePct").textContent = pct + "%";
    setTimeout(() => {
      document.getElementById("profileBar").style.width = pct + "%";
    }, 200);
  }

  /* ── Stats: fetch per-user counts ───────────────────── */
  async function loadStats() {
    const headers = { "Authorization": `Bearer ${TOKEN}` };

    /* My listings count */
    try {
      const r = await fetch(`${API}/listings?mine=true&limit=1`, { headers });
      const d = await r.json();
      const n = d.data?.pagination?.total ?? d.pagination?.total ?? (d.data?.listings?.length ?? "—");
      document.getElementById("statListings").textContent = n;
    } catch { document.getElementById("statListings").textContent = "0"; }

    /* Matches count */
    try {
      const r = await fetch(`${API}/listings?limit=1`, { headers });
      const d = await r.json();
      const n = d.data?.pagination?.total ?? "—";
      document.getElementById("statMatches").textContent = n;
    } catch { document.getElementById("statMatches").textContent = "0"; }

    /* Conversations */
    try {
      const r = await fetch(`${API}/chat/conversations`, { headers });
      const d = await r.json();
      const arr = d.data || d.conversations || d || [];
      document.getElementById("statChats").textContent =
        Array.isArray(arr) ? arr.length : (arr.total ?? "0");
    } catch { document.getElementById("statChats").textContent = "0"; }

    /* Saved — placeholder */
    document.getElementById("statSaved").textContent = "0";
  }

  /* ── Recent listings ─────────────────────────────────── */
  const ROOM_LABELS = {
    single:"Single Room", shared:"Shared Room",
    entire_flat:"Entire Flat", pg:"PG"
  };

  function escH(s) {
    return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function imgSrc(p) {
    if (!p) return "";
    if (p.startsWith("http")) return p;
    // Normalise: strip leading slashes/backslashes, find uploads/ segment
    const clean = p.replace(/\\/g, "/").replace(/^\/+/, "");
    const idx   = clean.indexOf("uploads/");
    const rel   = idx !== -1 ? clean.slice(idx) : clean;
    return IMG + "/" + rel;
  }

  function buildCard(l) {
    const img   = imgSrc(l.image);
    const title = escH(l.title || "Untitled");
    const city  = escH(l.city  || l.area || "India");
    const type  = ROOM_LABELS[l.roomType] || escH(l.roomType || "Room");
    const rent  = l.rent?.amount
      ? "₹" + Number(l.rent.amount).toLocaleString("en-IN") + "/mo"
      : "On request";

    return `
      <a class="listing-card" href="./listings.html" title="${title}">
        <div class="listing-card-img">
          ${img ? `<img src="${escH(img)}" alt="${title}" loading="lazy"
                     onerror="this.style.display='none'; this.insertAdjacentHTML('afterend','<span style=\\'font-size:2rem;\\'>🏠</span>');">` : "🏠"}
          <span class="listing-card-type">${escH(type)}</span>
          <span class="listing-card-badge">${escH(rent)}</span>
        </div>
        <div class="listing-card-body">
          <div class="listing-card-title">${title}</div>
          <div class="listing-card-loc">📍 ${city}</div>
          <div class="listing-card-chips">
            ${l.furnishingStatus
              ? `<span class="chip">🪑 ${escH(l.furnishingStatus)}</span>` : ""}
            ${l.genderPreference
              ? `<span class="chip">👤 ${escH(l.genderPreference)}</span>` : ""}
            ${l.availableFrom
              ? `<span class="chip">📅 Available</span>` : ""}
          </div>
        </div>
      </a>`;
  }

  async function loadListings() {
    const grid = document.getElementById("listingsGrid");
    try {
      const headers = { "Authorization": `Bearer ${TOKEN}` };
      const res  = await fetch(`${API}/listings?page=1&limit=3&sort=newest`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = data.data?.listings || data.listings || data.data || [];
      if (!list.length) throw new Error("empty");
      grid.innerHTML = list.map(buildCard).join("");
    } catch {
      grid.innerHTML = `
        <div class="listings-empty">
          <div class="listings-empty-icon">🏠</div>
          <div>No listings yet —
            <a href="./add-listing.html"
               style="color:#13C4A3;text-decoration:none;font-weight:700;">
              post the first one</a>
          </div>
        </div>`;
    }
  }

  loadStats();
  loadListings();