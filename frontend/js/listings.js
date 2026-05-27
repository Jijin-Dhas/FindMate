// frontend/js/listings.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Browse Listings Page  (UPDATED v4.0: Reviews)
//
//  Changes from v3.0:
//  ✅ openDetail() — injects #reviewsSection placeholder
//  ✅ openDetail() — calls loadReviews() from reviews.js
//  ✅ detail-card  — gets data-listing-id attr for delete reload
// ═══════════════════════════════════════════════════════════

const API_BASE    = "http://localhost:5000/api";
const SERVER_BASE = "http://localhost:5000"; // base URL for image paths

// ─────────────────────────────────────────────────────────
//  AUTH STATE
// ─────────────────────────────────────────────────────────
const token    = localStorage.getItem("findmate_token");
const userJson = localStorage.getItem("findmate_user");

let currentUser = null;
try {
  if (userJson) currentUser = JSON.parse(userJson);
} catch (e) { currentUser = null; }


// ─────────────────────────────────────────────────────────
//  NAVBAR
//  Auth state + hamburger are handled by navbar.js (loaded
//  before this script in listings.html). Nothing to do here.
// ─────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────
let allListings = [];
let filtered    = [];


// ─────────────────────────────────────────────────────────
//  IMAGE URL HELPER
//  ──────────────────────────────────────────────────────────
//  The database stores: "uploads/listing-1703123456789.jpg"
//  We need:             "http://localhost:5000/uploads/listing-123.jpg"
//  This function converts the stored path to a full URL.
//
//  DEBUG: logs the resolved URL to the console so you can verify
//  the path is correct when troubleshooting image display issues.
// ─────────────────────────────────────────────────────────
function getImageUrl(imagePath) {
  if (!imagePath) return null;

  // If already a full URL (http:// or https://) return as-is
  if (imagePath.startsWith("http")) return imagePath;

  // Normalise: remove any leading slash or backslash, replace backslashes
  const clean = imagePath.replace(/\\/g, "/").replace(/^\/+/, "");

  // Ensure the path starts with "uploads/" — if somehow stored as absolute,
  // extract just the uploads/... portion
  const uploadsIdx = clean.indexOf("uploads/");
  const relative   = uploadsIdx !== -1 ? clean.slice(uploadsIdx) : clean;

  const url = `${SERVER_BASE}/${relative}`;
  console.log("🖼️  [getImageUrl] resolved:", url, "| raw stored path:", imagePath);
  return url;
}


// ─────────────────────────────────────────────────────────
//  FETCH LISTINGS
// ─────────────────────────────────────────────────────────
async function fetchListings() {
  const grid = document.getElementById("listingsGrid");

  try {
    const response = await fetch(`${API_BASE}/listings?limit=100`);
    const data     = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load listings");
    }

    allListings = data.data.listings || [];
    filtered    = [...allListings];

    // DEBUG: log fetched listings and their image paths
    console.log(`📋 [fetchListings] Loaded ${allListings.length} listings`);
    allListings.forEach((l, i) => {
      console.log(`  [${i}] "${l.title}" | image: ${l.image || "(none)"}`);
    });

    const totalCount = document.getElementById("totalCount");
    if (totalCount) totalCount.textContent = data.total || allListings.length;

    ["skel1","skel2","skel3"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    renderListings(filtered);

  } catch (error) {
    console.error("Fetch listings error:", error);
    ["skel1","skel2","skel3"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😕</div>
        <h3 class="empty-title">Could not load listings</h3>
        <p class="empty-text">Make sure the backend server is running at<br/><strong>${API_BASE}</strong></p>
        <button class="btn-empty-cta" onclick="fetchListings()">Try Again</button>
      </div>`;
  }
}


// ─────────────────────────────────────────────────────────
//  RENDER LISTING CARDS
// ─────────────────────────────────────────────────────────
function renderListings(listings) {
  const grid        = document.getElementById("listingsGrid");
  const filterCount = document.getElementById("filterCount");

  if (filterCount) {
    filterCount.innerHTML = `Showing <strong>${listings.length}</strong> listing${listings.length !== 1 ? "s" : ""}`;
  }

  if (listings.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏠</div>
        <h3 class="empty-title">No listings found</h3>
        <p class="empty-text">No rooms match your current filters. Try broadening your search!</p>
        ${token
          ? `<a href="./add-listing.html" class="btn-empty-cta">Post a Room</a>`
          : `<a href="./login.html" class="btn-empty-cta">Sign in to Post</a>`}
      </div>`;
    return;
  }

  grid.innerHTML = listings.map((listing, index) => buildCard(listing, index)).join("");

  // ── Asynchronously populate star ratings on cards ──────
  // loadCardRatings is in reviews.js — fetch avg rating per listing
  // and inject it onto the card badges (non-blocking, best-effort)
  try {
    if (typeof loadCardRatings === "function") {
      loadCardRatings(listings);
    }
  } catch(e) { /* reviews.js not loaded — silent fail */ }
}


// ─────────────────────────────────────────────────────────
//  BUILD CARD HTML (now includes room image at top)
// ─────────────────────────────────────────────────────────
function buildCard(listing, index) {
  // ── Safe value extraction ──
  const title      = listing.title || "Untitled Listing";
  const desc       = listing.description || "";
  const city       = listing.location?.city || "Unknown City";
  const area       = listing.location?.area || "";
  const rentAmt    = listing.rent?.amount?.toLocaleString("en-IN") || "N/A";
  const negotiable = listing.rent?.isNegotiable;
  const roomType   = listing.roomType || "single";
  const gender     = listing.preferredTenant?.gender || "any";
  const amenities  = listing.amenities || [];
  const posterName = listing.postedBy?.name || "Anonymous";
  const posterId   = listing.postedBy?._id || "";
  const listingId  = listing._id;

  // ── Image ──
  const imageUrl = getImageUrl(listing.image);

  // ── Date ──
  let availText = "Now";
  if (listing.availableFrom) {
    const d = new Date(listing.availableFrom);
    availText = d.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
  }

  // Is this listing less than 3 days old? Show "NEW" ribbon
  const isNew = listing.createdAt &&
    (Date.now() - new Date(listing.createdAt).getTime()) < 3 * 24 * 60 * 60 * 1000;

  // ── Labels ──
  const roomTypeLabels = { single:"Single", shared:"Shared", entire_flat:"Entire Flat", pg:"PG" };
  const genderLabels   = { male:"♂ Male Only", female:"♀ Female Only", any:"⚥ Any" };

  // ── Amenity chips (max 3 shown) ──
  const shown = amenities.slice(0, 3).map(a => `<span class="amenity-chip">${escapeHtml(a)}</span>`).join("");
  const extra = amenities.length > 3 ? `<span class="amenity-more">+${amenities.length - 3}</span>` : "";

  const isOwner = currentUser && (posterId === currentUser._id || posterId === currentUser.id);
  const initial = posterName.charAt(0).toUpperCase();

  // ── Chat URL (v8.0) ──────────────────────────────────────
  const chatUrl = `./chat.html?userId=${encodeURIComponent(posterId)}&userName=${encodeURIComponent(posterName)}`;

  return `
    <div class="listing-card" style="animation-delay:${index * 60}ms;">

      <!-- ── ROOM IMAGE (NEW in v3.0) ── -->
      <div class="card-image">
        ${imageUrl
          ? `<img
               src="${imageUrl}"
               alt="Room photo for ${escapeHtml(title)}"
               loading="lazy"
               style="width:100%;height:100%;object-fit:cover;display:block;"
               onerror="console.warn('⚠️ Image failed to load:', this.src); this.style.display='none'; this.nextElementSibling.style.display='flex';"
             />
             <div class="card-img-placeholder" style="display:none;">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                 <rect x="3" y="3" width="18" height="18" rx="2"/>
                 <circle cx="8.5" cy="8.5" r="1.5"/>
                 <polyline points="21 15 16 10 5 21"/>
               </svg>
               <span>Photo unavailable</span>
             </div>`
          : `<div class="card-img-placeholder">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                 <rect x="3" y="3" width="18" height="18" rx="2"/>
                 <circle cx="8.5" cy="8.5" r="1.5"/>
                 <polyline points="21 15 16 10 5 21"/>
               </svg>
               <span>No Photo</span>
             </div>`
        }
        <!-- Room type badge overlaid on image -->
        <span class="badge ${`badge-${roomType}`} card-image-badge">
          ${roomTypeLabels[roomType] || roomType}
        </span>
        <!-- "NEW" ribbon for recent listings -->
        ${isNew ? `<span class="card-image-new">New</span>` : ""}
      </div><!-- /.card-image -->

      <!-- ── CARD BODY ── -->
      <div class="card-accent"></div>
      <div class="card-body">
        <div class="card-title-row">
          <h3 class="card-title">${escapeHtml(title)}</h3>
        </div>
        <div class="card-location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          ${escapeHtml(city)}${area ? `, ${escapeHtml(area)}` : ""}
        </div>
        <div class="card-rent">
          <span class="rent-currency">₹</span>
          <span class="rent-amount">${rentAmt}</span>
          <span class="rent-period">/month</span>
          ${negotiable ? '<span class="rent-tag">Negotiable</span>' : ""}
        </div>
        <p class="card-desc">${escapeHtml(desc)}</p>
        <div class="card-meta">
          <span class="card-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            ${genderLabels[gender] || gender}
          </span>
          <span class="card-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            From ${availText}
          </span>
        </div>
        ${amenities.length > 0 ? `<div class="card-amenities">${shown}${extra}</div>` : ""}
      </div>

      <!-- ══ CARD FOOTER v8.0 ════════════════════════════════
           Column layout:
             Row 1 — poster avatar + name + safety badges
             Row 2 — privacy notice
             Row 3 — unified action buttons
      ════════════════════════════════════════════════════ -->
      <div class="card-footer">

        <!-- Row 1: Poster identity + safety badges -->
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="card-poster" style="flex:1;min-width:0;">
            <div class="poster-avatar">${initial}</div>
            <div class="poster-info">
              <div class="poster-name">${escapeHtml(posterName)}</div>
              <div class="poster-role-tag">Listing Owner</div>
            </div>
          </div>
          <div class="card-safety-row">
            ${typeof renderVerifiedBadge === "function" ? renderVerifiedBadge(listing.views > 30) : ""}
            ${typeof renderSafeBadge    === "function" ? renderSafeBadge(true) : ""}
          </div>
        </div>

        <!-- Row 2: Privacy notice -->
        <div class="card-contact-row card-privacy-notice">
          <span class="contact-icon">💬</span>
          <span class="contact-privacy-text">Contact through Chat only</span>
        </div>

        <!-- Row 3: Uniform action buttons -->
        <div class="card-actions">
          <button class="card-btn card-btn-view"
            onclick="openDetail('${listingId}')"
            title="View listing details">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View
          </button>
          ${isOwner ? `
            <button class="card-btn card-btn-edit"
              onclick="openEditModal('${listingId}')" title="Edit your listing">✏️ Edit</button>
            <button class="card-btn card-btn-delete"
              onclick="deleteListing('${listingId}')" title="Delete your listing">🗑 Delete</button>
          ` : `
            <a class="card-btn card-btn-chat" href="${chatUrl}"
              title="Chat with ${escapeHtml(posterName)}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Chat
            </a>
            <button class="card-btn card-btn-report"
              onclick="openReportModal('listing','${listingId}','${escapeHtml(title).replace(/'/g,"&apos;")}')"
              title="Report this listing">🚩 Report</button>
          `}
        </div>

      </div><!-- /.card-footer -->

    </div>`;
}

/** Escapes HTML to prevent XSS */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}


// ═══════════════════════════════════════════════════════════
//  NEARBY LOCATION FINDER — v4.0 helper functions
// ═══════════════════════════════════════════════════════════

/**
 * Returns configuration for each place type:
 *   icon     — emoji shown in the circle
 *   label    — human-readable label shown as a badge
 *   bg       — background color of the icon circle
 *   badgeBg  — background of the type badge pill
 *   badgeFg  — text color of the type badge pill
 *
 * @param {string} type — one of: college, hospital, bus_stop, supermarket, restaurant
 */
function getNearbyTypeConfig(type) {
  const configs = {
    college:     { icon: "🎓", label: "College",     bg: "#EFF6FF", badgeBg: "#DBEAFE", badgeFg: "#1D4ED8" },
    hospital:    { icon: "🏥", label: "Hospital",    bg: "#F0FDF4", badgeBg: "#DCFCE7", badgeFg: "#16A34A" },
    bus_stop:    { icon: "🚌", label: "Bus Stop",    bg: "#FFFBEB", badgeBg: "#FEF3C7", badgeFg: "#D97706" },
    supermarket: { icon: "🛒", label: "Supermarket", bg: "#FFF7ED", badgeBg: "#FFEDD5", badgeFg: "#EA580C" },
    restaurant:  { icon: "🍽️", label: "Restaurant",  bg: "#FDF4FF", badgeBg: "#F3E8FF", badgeFg: "#9333EA" },
  };
  // Return config for type, or a grey default if unknown
  return configs[type] || { icon: "📍", label: type, bg: "#F1F5F9", badgeBg: "#E2E8F0", badgeFg: "#64748B" };
}

/**
 * Builds the HTML string for the "Nearby Locations" section.
 * Returns an empty string if there are no nearby places to show.
 *
 * @param {Array} places — listing.nearbyPlaces from MongoDB
 * @returns {string}     — HTML string injected into the detail overlay
 */
function buildNearbySection(places) {
  // Don't render anything if the array is empty or missing
  if (!places || places.length === 0) return "";

  // Build one card per nearby place
  const cardsHtml = places.map((place) => {
    const cfg = getNearbyTypeConfig(place.type);
    return `
      <div class="nearby-card">
        <!-- Colored icon circle -->
        <div class="nearby-icon" style="background:${cfg.bg};">
          ${cfg.icon}
        </div>
        <!-- Place name, type badge, distance -->
        <div class="nearby-info">
          <div class="nearby-name" title="${escapeHtml(place.name)}">
            ${escapeHtml(place.name)}
          </div>
          <div class="nearby-meta">
            <span class="nearby-type-badge" style="background:${cfg.badgeBg}; color:${cfg.badgeFg};">
              ${cfg.label}
            </span>
            ${place.distance
              ? `<span class="nearby-distance">📏 ${escapeHtml(place.distance)}</span>`
              : ""}
          </div>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="nearby-section">
      <div class="nearby-section-title">📍 Nearby Locations</div>
      <div class="nearby-grid">
        ${cardsHtml}
      </div>
    </div>`;
}

/**
 * Builds the HTML string for the embedded Google Map section.
 * Returns an empty string if no map link was provided.
 *
 * @param {string|null} mapLink — listing.googleMapLink (the iframe src URL)
 * @returns {string}            — HTML string injected into the detail overlay
 */
function buildMapSection(mapLink) {
  if (!mapLink) return "";

  return `
    <div class="map-section">
      <div class="map-section-title">🗺️ Location on Map</div>
      <iframe
        src="${mapLink}"
        class="map-embed-frame"
        allowfullscreen=""
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        title="Google Map showing listing location"
      ></iframe>
    </div>`;
}


// ─────────────────────────────────────────────────────────
//  DETAIL MODAL — Full listing view with large image
// ─────────────────────────────────────────────────────────
function openDetail(listingId) {
  const listing = allListings.find(l => l._id === listingId);
  if (!listing) return;

  const imageUrl   = getImageUrl(listing.image);
  const roomLabels = { single:"Single Room", shared:"Shared Room", entire_flat:"Entire Flat", pg:"PG" };
  const genderLbls = { male:"Male Only", female:"Female Only", any:"Any Gender" };
  const amenities  = listing.amenities || [];

  // DEBUG: log modal image info
  console.log(`🔍 [openDetail] Listing: "${listing.title}" | image field: ${listing.image} | resolved URL: ${imageUrl}`);

  const availText = listing.availableFrom
    ? new Date(listing.availableFrom).toLocaleDateString("en-IN",{ day:"numeric", month:"long", year:"numeric" })
    : "Immediately";

  // Build the detail modal HTML
  document.getElementById("detailOverlay").innerHTML = `
    <div class="detail-card">

      <!-- Close button -->
      <button class="detail-close" onclick="closeDetail()" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>

      <!-- Hero image (or placeholder) -->
      ${imageUrl
        ? `<div class="detail-hero-image">
             <img
               src="${imageUrl}"
               alt="Room photo"
               style="width:100%;height:100%;object-fit:cover;display:block;"
               onerror="console.warn('⚠️ [modal] Image failed to load:', this.src); this.parentElement.classList.add('detail-no-image'); this.parentElement.classList.remove('detail-hero-image'); this.remove();"
             />
           </div>`
        : `<div class="detail-no-image">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
               <rect x="3" y="3" width="18" height="18" rx="2"/>
               <circle cx="8.5" cy="8.5" r="1.5"/>
               <polyline points="21 15 16 10 5 21"/>
             </svg>
             <span>No photo uploaded</span>
           </div>`}

      <!-- Detail content -->
      <div class="detail-content">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:8px;">
          <h2 style="font-family:var(--font-display); font-size:1.5rem; font-weight:700; color:var(--navy); line-height:1.2;">
            ${escapeHtml(listing.title)}
          </h2>
          <span class="badge badge-${listing.roomType}" style="flex-shrink:0; margin-top:4px;">
            ${roomLabels[listing.roomType] || listing.roomType}
          </span>
        </div>

        <div style="display:flex; align-items:center; gap:6px; color:var(--text-mid); font-size:0.9rem; margin-bottom:16px;">
          📍 ${escapeHtml(listing.location?.city || "")}${listing.location?.area ? `, ${escapeHtml(listing.location.area)}` : ""}
        </div>

        <!-- Rent big display -->
        <div style="background:var(--input-bg); border-radius:var(--radius-sm); padding:16px 20px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.8px; color:var(--text-light); font-weight:700; margin-bottom:4px;">Monthly Rent</div>
            <div style="font-family:var(--font-display); font-size:2rem; font-weight:700; color:var(--navy);">
              ₹${(listing.rent?.amount || 0).toLocaleString("en-IN")}
              <span style="font-size:0.9rem; color:var(--text-light); font-weight:400;">/month</span>
            </div>
            ${listing.rent?.isNegotiable ? `<span class="rent-tag" style="margin-left:0;">Negotiable</span>` : ""}
          </div>
        </div>

        <!-- Info grid -->
        <div class="detail-info-grid">
          <div class="detail-info-item">
            <span class="detail-info-label">Available From</span>
            <span class="detail-info-value">📅 ${availText}</span>
          </div>
          <div class="detail-info-item">
            <span class="detail-info-label">Gender Preference</span>
            <span class="detail-info-value">${genderLbls[listing.preferredTenant?.gender] || "Any"}</span>
          </div>
          <div class="detail-info-item">
            <span class="detail-info-label">Views</span>
            <span class="detail-info-value">👁 ${listing.views || 0} views</span>
          </div>
          <div class="detail-info-item">
            <span class="detail-info-label">Posted By</span>
            <span class="detail-info-value">👤 ${escapeHtml(listing.postedBy?.name || "Anonymous")}</span>
          </div>
        </div>

        <!-- Description -->
        <div style="margin-bottom:20px;">
          <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.8px; color:var(--text-light); font-weight:700; margin-bottom:10px;">Description</div>
          <p style="font-size:0.92rem; color:var(--text-mid); line-height:1.7;">${escapeHtml(listing.description)}</p>
        </div>

        <!-- Amenities -->
        ${amenities.length > 0 ? `
          <div>
            <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.8px; color:var(--text-light); font-weight:700; margin-bottom:10px;">Amenities</div>
            <div class="card-amenities">
              ${amenities.map(a => `<span class="amenity-chip">${escapeHtml(a)}</span>`).join("")}
            </div>
          </div>
        ` : ""}

        <!-- ══ REVIEWS SECTION ══════════════════════════════
             This empty div is the injection point for reviews.
             reviews.js reads this id and fills it in after
             fetching the review data from the API.
        ════════════════════════════════════════════════════ -->

        <!-- ══ NEARBY PLACES SECTION (v4.0) ════════════════
             Shown only if the listing has nearbyPlaces data.
             Built by buildNearbySection() helper below.
        ════════════════════════════════════════════════════ -->
        ${buildNearbySection(listing.nearbyPlaces)}

        <!-- ══ GOOGLE MAP SECTION (v4.0) ════════════════════
             Shown below nearby places if googleMapLink exists.
        ════════════════════════════════════════════════════ -->
        ${buildMapSection(listing.googleMapLink)}

        <!-- ══ SAFETY & TRUST SECTION (v7.0) ════════════════
             Trust score ring + report button in detail view
        ════════════════════════════════════════════════════ -->
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f0f4f8;">
          <div style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-light);font-weight:700;margin-bottom:10px;">Safety &amp; Trust</div>
          <div class="listing-safety-banner verified">
            🛡️ This listing passed our basic safety checks
          </div>
          ${typeof renderTrustScoreWidget === "function"
            ? renderTrustScoreWidget(computeListingTrustScore(listing), "Listing Trust Score")
            : ""}
          <div style="margin-top:12px;display:flex;justify-content:flex-end;">
            <button class="btn-report"
              onclick="openReportModal('listing','${listingId}','${escapeHtml(listing.title || "").replace(/'/g, "&apos;")}')">
              🚩 Report this listing
            </button>
          </div>
        </div>

        <div id="reviewsSection">
          <!-- reviews.js fills this in via loadReviews() -->
        </div>

      </div>
    </div>`;

  // Open the overlay
  document.getElementById("detailOverlay").classList.add("open");
  document.body.style.overflow = "hidden";

  // ── Load reviews for this listing ──────────────────────
  // loadReviews() is defined in reviews.js (loaded in listings.html).
  // We call it AFTER the overlay HTML is injected so #reviewsSection exists.
  // We wrap in try/catch so a missing reviews.js doesn't break the detail view.
  try {
    if (typeof loadReviews === "function") {
      loadReviews(listingId);
    }
  } catch (e) {
    console.warn("Could not load reviews:", e);
  }
}

function closeDetail() {
  document.getElementById("detailOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

// Close detail modal when clicking outside
document.getElementById("detailOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeDetail();
});


// ─────────────────────────────────────────────────────────
//  FILTER LOGIC
// ─────────────────────────────────────────────────────────
function applyFilters() {
  const cityQ    = document.getElementById("filterCity").value.trim().toLowerCase();
  const rtVal    = document.getElementById("filterRoomType").value;
  const gVal     = document.getElementById("filterGender").value;
  const maxRent  = Number(document.getElementById("filterMaxRent").value) || Infinity;

  filtered = allListings.filter(l => {
    if (cityQ) {
      const c = (l.location?.city || "").toLowerCase();
      const a = (l.location?.area || "").toLowerCase();
      if (!c.includes(cityQ) && !a.includes(cityQ)) return false;
    }
    if (rtVal && l.roomType !== rtVal) return false;
    if (gVal  && l.preferredTenant?.gender !== gVal) return false;
    if (l.rent?.amount > maxRent) return false;
    return true;
  });

  renderListings(filtered);
}

document.getElementById("filterCity").addEventListener("input",     applyFilters);
document.getElementById("filterRoomType").addEventListener("change", applyFilters);
document.getElementById("filterGender").addEventListener("change",   applyFilters);
document.getElementById("filterMaxRent").addEventListener("change",  applyFilters);

document.getElementById("btnClearFilters").addEventListener("click", () => {
  document.getElementById("filterCity").value     = "";
  document.getElementById("filterRoomType").value = "";
  document.getElementById("filterGender").value   = "";
  document.getElementById("filterMaxRent").value  = "";
  filtered = [...allListings];
  renderListings(filtered);
});


// ─────────────────────────────────────────────────────────
//  EDIT MODAL (updated to handle image replacement)
// ─────────────────────────────────────────────────────────
let editImageChanged = false; // tracks if user picked a new image

function openEditModal(listingId) {
  const listing = allListings.find(l => l._id === listingId);
  if (!listing) return;

  editImageChanged = false;

  // Fill text fields
  document.getElementById("editListingId").value        = listingId;
  document.getElementById("editTitle").value            = listing.title || "";
  document.getElementById("editCity").value             = listing.location?.city || "";
  document.getElementById("editArea").value             = listing.location?.area || "";
  document.getElementById("editRent").value             = listing.rent?.amount || "";
  document.getElementById("editRoomType").value         = listing.roomType || "";
  document.getElementById("editGender").value           = listing.preferredTenant?.gender || "any";
  document.getElementById("editContact").value          = listing.contactNumber || "";
  document.getElementById("editDescription").value      = listing.description || "";
  document.getElementById("editNegotiable").checked     = listing.rent?.isNegotiable || false;

  if (listing.availableFrom) {
    const d = new Date(listing.availableFrom);
    document.getElementById("editAvailableFrom").value  = d.toISOString().split("T")[0];
  }

  // Show current image in the edit modal
  const currentImgEl       = document.getElementById("editCurrentImg");
  const currentImgWrap     = document.getElementById("editCurrentImgWrap");
  const editImgInput       = document.getElementById("editImageInput");
  const editImgPreview     = document.getElementById("editImgPreview");
  const editImgPreviewWrap = document.getElementById("editImgPreviewWrap");

  // Clear previous edit state
  editImgInput.value = "";
  editImgPreview.src = "";
  editImgPreviewWrap.style.display = "none";

  const imageUrl = getImageUrl(listing.image);
  console.log(`✏️  [openEdit] Listing: "${listing.title}" | image: ${listing.image} | URL: ${imageUrl}`);
  if (imageUrl && currentImgWrap) {
    currentImgEl.src               = imageUrl;
    currentImgEl.onerror           = () => {
      console.warn("⚠️ [editModal] Current image failed to load:", imageUrl);
      currentImgWrap.style.display = "none";
    };
    currentImgWrap.style.display   = "block";
  } else if (currentImgWrap) {
    currentImgWrap.style.display   = "none";
  }

  // When user picks a new image for the edit form
  editImgInput.addEventListener("change", () => {
    const file = editImgInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image too large (max 5MB)", "error");
      editImgInput.value = "";
      return;
    }
    editImageChanged = true;
    const reader = new FileReader();
    reader.onload = (e) => {
      editImgPreview.src             = e.target.result;
      editImgPreviewWrap.style.display = "block";
      if (currentImgWrap) currentImgWrap.style.display = "none";
    };
    reader.readAsDataURL(file);
  }, { once: true }); // once:true prevents stacking listeners on re-open

  document.getElementById("editModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("editModal").classList.remove("open");
  document.body.style.overflow = "";
}

document.getElementById("editModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModal(); closeDetail(); }
});


// ── Edit form submit — uses FormData for image support ──
document.getElementById("editForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const listingId = document.getElementById("editListingId").value;
  const submitBtn = document.getElementById("editSubmitBtn");

  const title       = document.getElementById("editTitle").value.trim();
  const description = document.getElementById("editDescription").value.trim();
  const city        = document.getElementById("editCity").value.trim();
  const rent        = document.getElementById("editRent").value;
  const roomType    = document.getElementById("editRoomType").value;

  if (!title || title.length < 5 || !description || description.length < 20 || !city || !rent || !roomType) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  // ── Build FormData ─────────────────────────────────────
  // Same pattern as add-listing.js — FormData handles text + optional file
  const fd = new FormData();
  fd.append("title",                    title);
  fd.append("description",              description);
  fd.append("location[city]",           city);
  fd.append("location[area]",           document.getElementById("editArea").value.trim());
  fd.append("rent[amount]",             rent);
  fd.append("rent[isNegotiable]",       document.getElementById("editNegotiable").checked);
  fd.append("roomType",                 roomType);
  fd.append("preferredTenant[gender]",  document.getElementById("editGender").value);
  fd.append("contactNumber",            document.getElementById("editContact").value.trim());

  const avail = document.getElementById("editAvailableFrom").value;
  if (avail) fd.append("availableFrom", avail);

  // Only add image if user picked a new one
  const editImgInput = document.getElementById("editImageInput");
  if (editImageChanged && editImgInput.files[0]) {
    fd.append("image", editImgInput.files[0]);
  }

  submitBtn.classList.add("loading");
  submitBtn.disabled = true;

  try {
    // ── PUT request with FormData ──────────────────────────
    // Same rule: NO Content-Type header — browser sets it automatically
    const response = await fetch(`${API_BASE}/listings/${listingId}`, {
      method:  "PUT",
      headers: { "Authorization": `Bearer ${token}` }, // NO Content-Type!
      body:    fd,
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showToast("Listing updated! ✅", "success");
      closeModal();

      // Update local state and re-render without full page reload
      const idx = allListings.findIndex(l => l._id === listingId);
      if (idx !== -1) allListings[idx] = { ...allListings[idx], ...data.data.listing };
      applyFilters();

    } else {
      showToast(data.message || "Update failed.", "error");
    }
  } catch (err) {
    console.error("Update error:", err);
    showToast("Network error.", "error");
  } finally {
    submitBtn.classList.remove("loading");
    submitBtn.disabled = false;
  }
});


// ─────────────────────────────────────────────────────────
//  DELETE LISTING (also removes image file via backend)
// ─────────────────────────────────────────────────────────
async function deleteListing(listingId) {
  if (!window.confirm("Delete this listing? This cannot be undone.")) return;

  try {
    const response = await fetch(`${API_BASE}/listings/${listingId}`, {
      method:  "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await response.json();

    if (response.ok && data.success) {
      showToast("Listing deleted.", "success");
      allListings = allListings.filter(l => l._id !== listingId);
      filtered    = filtered.filter(l => l._id !== listingId);
      renderListings(filtered);
    } else {
      showToast(data.message || "Delete failed.", "error");
    }
  } catch (err) {
    console.error("Delete error:", err);
    showToast("Network error.", "error");
  }
}


// ─────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────
function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ""}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.4s";
    setTimeout(() => toast.remove(), 400);
  }, duration);
}


// ─────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────
fetchListings();
