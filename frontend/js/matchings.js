// frontend/js/matchings.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Smart Match Page Script
//
//  WHAT THIS FILE DOES:
//  1. Reads the logged-in user from localStorage
//  2. Calls GET /api/matchings (private route — sends JWT token)
//  3. Gets listings sorted by compatibility score from backend
//  4. Renders listing cards with:
//       ✅ Match percentage badge (e.g. "78%")
//       ✅ Color-coded indicator (green = great, red = poor)
//       ✅ Match label (e.g. "Great Match")
//       ✅ Breakdown tooltip (which factors matched)
//  5. Provides sort controls (highest/lowest match)
//  6. Shows a message if user profile is incomplete
// ═══════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────
const API_BASE    = window.APP_CONFIG.API_BASE;
const SERVER_BASE = window.APP_CONFIG.SERVER_BASE; // for building image URLs

// ─────────────────────────────────────────────────────────
//  IMAGE URL HELPER (mirrors listings.js logic)
// ─────────────────────────────────────────────────────────
function getImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  const clean = imagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const uploadsIdx = clean.indexOf("uploads/");
  const relative   = uploadsIdx !== -1 ? clean.slice(uploadsIdx) : clean;
  return `${SERVER_BASE}/${relative}`;
}


// ─────────────────────────────────────────────────────────
//  AUTH STATE
//  We read the stored login token and user data from localStorage.
//  These were saved by login.js when the user signed in.
// ─────────────────────────────────────────────────────────
const token    = localStorage.getItem("findmate_token");
const userJson = localStorage.getItem("findmate_user");

let currentUser = null;
try {
  if (userJson) currentUser = JSON.parse(userJson);
} catch (e) {
  currentUser = null;
}

// Redirect to login if not logged in
if (!token || !currentUser) {
  window.location.href = "./login.html";
}


// ─────────────────────────────────────────────────────────
//  NAVBAR — handled by navbar.js (loaded before this script)
// ─────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────
//  STATE
//  allListings  = original data from API (sorted by score already)
//  displayed    = what's currently shown (after sort toggle)
// ─────────────────────────────────────────────────────────
let allListings = [];
let sortOrder   = "desc"; // "desc" = highest match first (default)


// ─────────────────────────────────────────────────────────
//  FETCH MATCHED LISTINGS FROM API
//
//  This calls GET /api/matchings with the JWT token.
//  The backend does all the heavy lifting:
//    → Calculates compatibility scores
//    → Sorts by score (highest first)
//  We just display the result!
// ─────────────────────────────────────────────────────────
async function fetchMatchedListings() {
  const grid       = document.getElementById("matchingsGrid");
  const loadingEl  = document.getElementById("loadingState");
  const emptyEl    = document.getElementById("emptyState");
  const countEl    = document.getElementById("totalMatchCount");

  // Show loading spinner
  if (loadingEl)  loadingEl.style.display  = "flex";
  if (emptyEl)    emptyEl.style.display    = "none";
  if (grid)       grid.innerHTML           = "";

  try {
    // ── Make the API call with our JWT token ──────────────
    const response = await fetch(`${API_BASE}/matchings?limit=50`, {
      method: "GET",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`, // ← This authenticates the user
      },
    });

    const data = await response.json();

    // Hide loading spinner
    if (loadingEl) loadingEl.style.display = "none";

    // Handle errors from the server
    if (!response.ok || !data.success) {
      // Token expired or invalid → redirect to login
      if (response.status === 401) {
        localStorage.removeItem("findmate_token");
        localStorage.removeItem("findmate_user");
        window.location.href = "./login.html";
        return;
      }
      throw new Error(data.message || "Failed to load matched listings");
    }

    // Store listings in our state variable
    allListings = data.data.listings || [];

    // Update the count display
    if (countEl) countEl.textContent = allListings.length;

    // Show profile incomplete warning if needed
    if (data.data.userProfile && !data.data.userProfile.profileComplete) {
      showProfileIncompleteWarning();
    }

    // Check if there are any listings
    if (allListings.length === 0) {
      if (emptyEl) emptyEl.style.display = "flex";
      return;
    }

    // Render all the listing cards
    renderMatchCards(allListings);

  } catch (error) {
    if (loadingEl) loadingEl.style.display = "none";
    console.error("Error fetching matched listings:", error);
    showToast(error.message || "Could not load listings. Please try again.", "error");
  }
}


// ─────────────────────────────────────────────────────────
//  RENDER MATCH CARDS
//
//  Takes an array of listings (each with matchScore, matchLabel,
//  matchColor) and renders HTML cards in the grid.
// ─────────────────────────────────────────────────────────
function renderMatchCards(listings) {
  const grid = document.getElementById("matchingsGrid");
  if (!grid) return;

  grid.innerHTML = ""; // Clear existing cards

  listings.forEach((listing) => {
    const card = createMatchCard(listing);
    grid.appendChild(card);
  });
}


// ─────────────────────────────────────────────────────────
//  CREATE A SINGLE MATCH CARD
//
//  This function builds the HTML for ONE listing card.
//  It adds the match badge and color strip at the top.
// ─────────────────────────────────────────────────────────
function createMatchCard(listing) {
  const card = document.createElement("div");
  card.className = "match-card";

  // Extract listing data
  const score     = listing.matchScore  || 0;
  const label     = listing.matchLabel  || "Unknown";
  const color     = listing.matchColor  || "#9ca3af";
  const breakdown = listing.matchBreakdown || {};

  // Format rent
  const rent = listing.rent?.amount
    ? `₹${Number(listing.rent.amount).toLocaleString("en-IN")}/mo`
    : "Rent on request";

  // Format city
  const city = listing.location?.city || "Unknown City";
  const area = listing.location?.area ? `, ${listing.location.area}` : "";

  // Format amenities (show first 3)
  const amenities = (listing.amenities || []).slice(0, 3);
  const amenityTags = amenities.map(a =>
    `<span class="amenity-tag">${escapeHtml(a)}</span>`
  ).join("");

  // Format available from date
  const availDate = listing.availableFrom
    ? new Date(listing.availableFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Immediately";

  // Build the breakdown tooltip HTML
  const breakdownHtml = buildBreakdownHtml(breakdown);

  // Room type badge
  const roomTypeMap = {
    single:      "Single Room",
    shared:      "Shared Room",
    entire_flat: "Entire Flat",
    pg:          "PG",
  };
  const roomTypeLabel = roomTypeMap[listing.roomType] || listing.roomType || "Room";

  // Lister name
  const listerName   = listing.postedBy?.name || "Unknown";
  const listerAvatar = listerName.charAt(0).toUpperCase();

  // Image URL
  const imageUrl = getImageUrl(listing.image);

  card.innerHTML = `
    <!-- ── MATCH SCORE STRIP (colored top bar) ───────────────── -->
    <div class="match-strip" style="background: ${color};">
      <div class="match-score-badge">
        <span class="match-percentage">${score}%</span>
        <span class="match-label-text">${label}</span>
      </div>
      <!-- Breakdown tooltip trigger -->
      <button class="breakdown-btn" onclick="toggleBreakdown(this)" title="See match breakdown">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </button>
    </div>

    <!-- ── BREAKDOWN PANEL (hidden by default) ───────────────── -->
    <div class="breakdown-panel hidden">
      <p class="breakdown-title">Why this score?</p>
      ${breakdownHtml}
    </div>

    <!-- ── ROOM IMAGE ─────────────────────────────────────────── -->
    <div class="match-card-image">
      ${imageUrl
        ? `<img
             src="${imageUrl}"
             alt="Room photo"
             style="width:100%;height:100%;object-fit:cover;display:block;"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
           />
           <div class="match-card-img-placeholder" style="display:none;">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;color:rgba(255,255,255,0.35);">
               <rect x="3" y="3" width="18" height="18" rx="2"/>
               <circle cx="8.5" cy="8.5" r="1.5"/>
               <polyline points="21 15 16 10 5 21"/>
             </svg>
             <span style="font-size:0.7rem;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;">No Photo</span>
           </div>`
        : `<div class="match-card-img-placeholder" style="display:flex;">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;color:rgba(255,255,255,0.35);">
               <rect x="3" y="3" width="18" height="18" rx="2"/>
               <circle cx="8.5" cy="8.5" r="1.5"/>
               <polyline points="21 15 16 10 5 21"/>
             </svg>
             <span style="font-size:0.7rem;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:1px;">No Photo</span>
           </div>`
      }
    </div>

    <!-- ── CARD BODY ─────────────────────────────────────────── -->
    <div class="match-card-body">

      <!-- Title & Room Type -->
      <div class="card-header-row">
        <h3 class="card-title">${escapeHtml(listing.title)}</h3>
        <span class="room-type-badge">${roomTypeLabel}</span>
      </div>

      <!-- Location -->
      <p class="card-location">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        ${escapeHtml(city)}${escapeHtml(area)}
      </p>

      <!-- Rent -->
      <p class="card-rent">${rent}
        ${listing.rent?.isNegotiable ? '<span class="negotiable-badge">Negotiable</span>' : ""}
      </p>

      <!-- Description preview -->
      <p class="card-description">${escapeHtml((listing.description || "").substring(0, 100))}${(listing.description || "").length > 100 ? "…" : ""}</p>

      <!-- Amenities -->
      ${amenities.length ? `<div class="amenity-tags">${amenityTags}</div>` : ""}

      <!-- Footer row: lister + date + contact -->
      <div class="card-footer-row">
        <div class="lister-info">
          <div class="lister-avatar">${listerAvatar}</div>
          <span class="lister-name">${escapeHtml(listerName)}</span>
        </div>
        <span class="card-date">From ${availDate}</span>
      </div>

      <!-- Action buttons -->
      <div class="card-actions">
        <a href="./chat.html?userId=${listing.postedBy?._id}&userName=${encodeURIComponent(listing.postedBy?.name || 'User')}"
           class="btn-details" style="text-decoration:none;text-align:center;">
          💬 Message
        </a>
        <button class="btn-report"
          onclick="openReportModal('listing','${listing._id}','${(listing.title||'').replace(/'/g,"\\'")}')"
          style="margin-left:auto;">
          🚩 Report
        </button>
      </div>

      <!-- Safety row -->
      <div class="card-safety-row" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
        ${typeof renderVerifiedBadge === "function" ? renderVerifiedBadge((listing.views||0) > 20) : ""}
        ${typeof renderSafeBadge    === "function" ? renderSafeBadge(true) : ""}
      </div>

    </div>
  `;

  return card;
}


// ─────────────────────────────────────────────────────────
//  BUILD BREAKDOWN HTML
//  Creates a small table showing each matching factor's score
// ─────────────────────────────────────────────────────────
function buildBreakdownHtml(breakdown) {
  if (!breakdown || Object.keys(breakdown).length === 0) {
    return "<p>No breakdown available.</p>";
  }

  // Label map for display
  const labels = {
    city:       { icon: "🏙️", name: "City" },
    budget:     { icon: "💰", name: "Budget" },
    gender:     { icon: "👤", name: "Gender" },
    smoking:    { icon: "🚬", name: "Smoking" },
    food:       { icon: "🍽️", name: "Food" },
    occupation: { icon: "💼", name: "Occupation" },
  };

  let html = '<ul class="breakdown-list">';

  for (const [key, value] of Object.entries(breakdown)) {
    const info   = labels[key] || { icon: "•", name: key };
    const pct    = Math.round((value.score / value.weight) * 100); // factor %
    const barColor = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

    html += `
      <li class="breakdown-item">
        <span class="factor-label">${info.icon} ${info.name}</span>
        <div class="factor-bar-wrap">
          <div class="factor-bar" style="width:${pct}%; background:${barColor};"></div>
        </div>
        <span class="factor-score">${value.score}/${value.weight}</span>
      </li>
    `;
  }

  html += "</ul>";
  return html;
}


// ─────────────────────────────────────────────────────────
//  TOGGLE BREAKDOWN PANEL
//  Shows/hides the factor breakdown when user clicks "ℹ"
// ─────────────────────────────────────────────────────────
function toggleBreakdown(btn) {
  // Find the breakdown panel in the same card
  const card  = btn.closest(".match-card");
  const panel = card.querySelector(".breakdown-panel");
  if (!panel) return;

  // Toggle visibility
  panel.classList.toggle("hidden");
}


// ─────────────────────────────────────────────────────────
//  SORT LISTINGS
//  Called when user clicks the sort button in the UI
// ─────────────────────────────────────────────────────────
function sortListings(order) {
  sortOrder = order;

  // Clone array to avoid mutating original
  const sorted = [...allListings].sort((a, b) => {
    if (order === "desc") return b.matchScore - a.matchScore; // highest first
    if (order === "asc")  return a.matchScore - b.matchScore; // lowest first
    return 0;
  });

  renderMatchCards(sorted);

  // Update sort button active state
  document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.sort === order);
  });
}


// ─────────────────────────────────────────────────────────
//  SHOW LISTING DETAILS (placeholder / link to detail page)
// ─────────────────────────────────────────────────────────
function showListingDetails(listingId) {
  // You can link to a detail page or open a modal
  // For now we open the listings page filtered to this ID
  window.location.href = `./listings.html#listing-${listingId}`;
}


// ─────────────────────────────────────────────────────────
//  PROFILE INCOMPLETE WARNING
//  If user hasn't filled their profile, scores will be inaccurate
// ─────────────────────────────────────────────────────────
function showProfileIncompleteWarning() {
  const warningEl = document.getElementById("profileWarning");
  if (warningEl) warningEl.style.display = "flex";
}


// ─────────────────────────────────────────────────────────
//  TOAST NOTIFICATION
//  Shows a small popup message at the bottom of the screen
// ─────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}


// ─────────────────────────────────────────────────────────
//  SECURITY HELPER: Escape HTML
//  Prevents XSS attacks — never inject raw user data as HTML
// ─────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


// ─────────────────────────────────────────────────────────
//  INIT — run when page loads
// ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Attach sort button listeners
  document.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => sortListings(btn.dataset.sort));
  });

  // Fetch and display matched listings
  fetchMatchedListings();
});
