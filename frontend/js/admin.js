// frontend/js/admin.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Admin Dashboard Logic  (NEW v6.0)
//
//  This file handles ALL admin dashboard functionality:
//  1. Auth check — redirect non-admins
//  2. Sidebar navigation
//  3. Dashboard stats cards
//  4. Manage Users table
//  5. Manage Listings table
//  6. Manage Reviews table
//  7. Reports & Complaints table
//  8. Toast notifications
//  9. Confirm modal (before delete/block)
// ═══════════════════════════════════════════════════════════

"use strict";

// ─── CONFIGURATION ──────────────────────────────────────────
const API_BASE  = window.APP_CONFIG.API_BASE;
const TOKEN_KEY = "findmate_token";
const USER_KEY  = "findmate_user";

// ─── READ AUTH FROM LOCAL STORAGE ───────────────────────────
const token       = localStorage.getItem(TOKEN_KEY);
const userJson    = localStorage.getItem(USER_KEY);
let   currentUser = null;

try {
  if (userJson) currentUser = JSON.parse(userJson);
} catch (e) { currentUser = null; }


// ─── AUTH GATE ──────────────────────────────────────────────
// If not logged in, redirect to login page immediately.
// If logged in but not admin, show the Access Denied screen.
(function authGate() {
  if (!token || !currentUser) {
    // Not logged in → go to login
    window.location.href = "./login.html";
    return;
  }

  if (currentUser.role !== "admin") {
    // Logged in but not admin → show denied screen
    document.getElementById("access-denied").classList.add("show");
    document.getElementById("admin-app").style.display = "none";
    return;
  }

  // Admin is confirmed — set up the admin info in sidebar
  const adminNameEl   = document.getElementById("adminName");
  const adminAvatarEl = document.getElementById("adminAvatar");
  if (adminNameEl)   adminNameEl.textContent   = currentUser.name || "Admin";
  if (adminAvatarEl) adminAvatarEl.textContent = (currentUser.name || "A").charAt(0).toUpperCase();
})();


// ─── API HELPER ─────────────────────────────────────────────
// Makes authenticated API calls with the admin JWT token.
// Returns the parsed JSON response, or throws on failure.
async function apiFetch(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}


// ─── TOAST NOTIFICATIONS ────────────────────────────────────
// Show small popup messages at the bottom-right of screen.
// type: "success" | "error" | "warning"
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast     = document.createElement("div");
  const icons     = { success: "✅", error: "❌", warning: "⚠️" };

  toast.className = `toast ${type !== "success" ? type : ""}`;
  toast.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${message}</span>`;
  container.appendChild(toast);

  // Auto-remove after 3.5 seconds
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.4s";
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}


// ─── CONFIRM MODAL ──────────────────────────────────────────
// Show a confirmation dialog before destructive actions.
// Returns a Promise that resolves to true (confirmed) or false.
function confirmDialog(title, body) {
  return new Promise((resolve) => {
    const modal   = document.getElementById("confirm-modal");
    const titleEl = document.getElementById("modal-title");
    const bodyEl  = document.getElementById("modal-body");
    const confirmBtn = document.getElementById("modal-confirm-btn");
    const cancelBtn  = document.getElementById("modal-cancel-btn");

    titleEl.textContent = title;
    bodyEl.textContent  = body;
    modal.classList.add("open");

    // Cleanup: remove old listeners and add fresh ones
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel  = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newConfirm.addEventListener("click", () => { modal.classList.remove("open"); resolve(true); });
    newCancel.addEventListener("click",  () => { modal.classList.remove("open"); resolve(false); });
  });
}


// ─── SIDEBAR NAVIGATION ─────────────────────────────────────
// Handle clicks on nav items: show the correct section,
// highlight the active item, update the header title.
function initNavigation() {
  const navItems   = document.querySelectorAll(".nav-item[data-section]");
  const sections   = document.querySelectorAll(".admin-section");
  const pageTitle  = document.getElementById("page-title");
  const hamburger  = document.getElementById("hamburger-btn");
  const sidebar    = document.getElementById("sidebar");
  const overlay    = document.getElementById("sidebar-overlay");

  function showSection(sectionId) {
    // Hide all sections
    sections.forEach(s => s.classList.remove("active"));
    // Remove active from all nav items
    navItems.forEach(n => n.classList.remove("active"));

    // Show selected section
    const target = document.getElementById(`section-${sectionId}`);
    if (target) target.classList.add("active");

    // Highlight selected nav item
    const activeNav = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
    if (activeNav) {
      activeNav.classList.add("active");
      // Update header title
      if (pageTitle) pageTitle.textContent = activeNav.querySelector(".nav-label").textContent;
    }

    // Load data for that section
    loadSection(sectionId);

    // Close sidebar on mobile after navigation
    closeSidebar();
  }

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      showSection(item.dataset.section);
    });
  });

  // Hamburger opens sidebar on mobile
  function openSidebar()  { sidebar.classList.add("open"); overlay.classList.add("show"); }
  function closeSidebar() { sidebar.classList.remove("open"); overlay.classList.remove("show"); }

  if (hamburger) hamburger.addEventListener("click", openSidebar);
  if (overlay)   overlay.addEventListener("click", closeSidebar);

  // Start on dashboard overview
  showSection("overview");
}


// ─── SECTION LOADER ─────────────────────────────────────────
// Called when a nav section is selected.
// Fetches and renders data for that section.
function loadSection(sectionId) {
  switch (sectionId) {
    case "overview":  loadStats(); break;
    case "users":     loadUsers(); break;
    case "listings":  loadListings(); break;
    case "reviews":   loadReviews(); break;
    case "reports":   loadReports(); break;
    case "verifications": loadVerifications(); break;
  }
}


// ═══════════════════════════════════════════════════════════
//  SECTION: DASHBOARD OVERVIEW
// ═══════════════════════════════════════════════════════════

async function loadStats() {
  try {
    const res = await apiFetch("/admin/stats");
    const s   = res.data;

    // Update all stat cards
    setStatCard("stat-total-users",    s.totalUsers);
    setStatCard("stat-active-listings", s.activeListings);
    setStatCard("stat-verified",       s.verifiedListings);
    setStatCard("stat-reviews",        s.totalReviews);
    setStatCard("stat-reports",        s.pendingReports);
    setStatCard("stat-blocked",        s.blockedUsers);

    // Update report badge in sidebar
    const reportBadge = document.getElementById("report-badge");
    if (reportBadge && s.pendingReports > 0) {
      reportBadge.textContent = s.pendingReports;
      reportBadge.style.display = "inline-block";
    }

    // Draw the mini charts
    drawListingChart(s);
    drawStatusDonut(s);
  } catch (err) {
    showToast("Failed to load dashboard stats", "error");
    console.error(err);
  }
}

// Helper: set a single stat card value with a counting animation
function setStatCard(id, value) {
  const el = document.getElementById(id);
  if (!el) return;

  // Animate count from 0 to value
  let current = 0;
  const step  = Math.ceil(value / 30);
  const timer = setInterval(() => {
    current = Math.min(current + step, value);
    el.textContent = current.toLocaleString();
    if (current >= value) clearInterval(timer);
  }, 30);
}

// Draw a simple CSS bar chart for listing status breakdown
function drawListingChart(stats) {
  const container = document.getElementById("listing-bar-chart");
  if (!container) return;

  const max = stats.totalListings || 1;
  const rows = [
    { label: "Active",   value: stats.activeListings,   color: "#00c9a7" },
    { label: "Verified", value: stats.verifiedListings,  color: "#10b981" },
    { label: "Total",    value: stats.totalListings,     color: "#1a3a6c" },
    { label: "Reviews",  value: stats.totalReviews,      color: "#f59e0b" },
  ];

  container.innerHTML = rows.map(r => `
    <div class="bar-row">
      <span class="bar-label">${r.label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round((r.value / max) * 100)}%;background:${r.color}"></div>
      </div>
      <span class="bar-value">${r.value}</span>
    </div>
  `).join("");
}

// Draw a CSS donut chart for user/listing status
function drawStatusDonut(stats) {
  const container = document.getElementById("status-donut");
  if (!container) return;

  const total    = stats.totalUsers || 1;
  const blocked  = stats.blockedUsers;
  const active   = total - blocked;
  const pctAct   = Math.round((active  / total) * 100);
  const pctBlk   = Math.round((blocked / total) * 100);

  container.innerHTML = `
    <div class="donut-wrap">
      <div class="donut-chart" style="background: conic-gradient(
        #00c9a7 0% ${pctAct}%,
        #ef4444 ${pctAct}% 100%
      )"></div>
      <div class="donut-legend">
        <div class="legend-item">
          <div class="legend-dot" style="background:#00c9a7"></div>
          <span>Active Users: ${active}</span>
        </div>
        <div class="legend-item">
          <div class="legend-dot" style="background:#ef4444"></div>
          <span>Blocked: ${blocked}</span>
        </div>
      </div>
    </div>
  `;
}


// ═══════════════════════════════════════════════════════════
//  SECTION: MANAGE USERS
// ═══════════════════════════════════════════════════════════
let usersPage = 1;
const usersPerPage = 15;

async function loadUsers(page = 1) {
  usersPage = page;
  const tableBody = document.getElementById("users-table-body");
  const container = document.getElementById("users-pagination");

  // Show loading state
  tableBody.innerHTML = `
    <tr><td colspan="6" class="loading-state">
      <div class="spinner"></div><p>Loading users...</p>
    </td></tr>`;

  try {
    const search = document.getElementById("user-search")?.value || "";
    const res    = await apiFetch(`/admin/users?page=${page}&limit=${usersPerPage}&search=${search}`);
    const { users, pagination } = res.data;

    if (!users.length) {
      tableBody.innerHTML = `
        <tr><td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <p>No users found</p>
          </div>
        </td></tr>`;
      return;
    }

    // Build table rows
    tableBody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-mini-avatar">${(u.name || "?").charAt(0).toUpperCase()}</div>
            <div>
              <div class="user-cell-name">${escHtml(u.name)}</div>
              <div class="user-cell-email">${escHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td class="col-hide-mobile">${escHtml(u.city || "—")}</td>
        <td class="col-hide-mobile">${formatDate(u.createdAt)}</td>
        <td>
          <span class="badge badge-${u.role}">${u.role}</span>
        </td>
        <td>
          ${u.isBlocked
            ? '<span class="badge badge-blocked">🚫 Blocked</span>'
            : '<span class="badge badge-active">✅ Active</span>'
          }
        </td>
        <td>
          <div class="btn-actions">
            ${u.isBlocked
              ? `<button class="btn-action btn-unblock" onclick="handleUnblockUser('${u._id}','${escHtml(u.name)}')">Unblock</button>`
              : `<button class="btn-action btn-block"   onclick="handleBlockUser('${u._id}','${escHtml(u.name)}')">Block</button>`
            }
            ${u.role !== "admin"
              ? `<button class="btn-action btn-delete" onclick="handleDeleteUser('${u._id}','${escHtml(u.name)}')">Delete</button>`
              : ""
            }
          </div>
        </td>
      </tr>
    `).join("");

    // Render pagination
    renderPagination(container, pagination, (p) => loadUsers(p));

  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:20px">Failed to load users</td></tr>`;
    showToast(err.message || "Failed to load users", "error");
  }
}

// Block a user (with confirmation)
window.handleBlockUser = async function(userId, userName) {
  const confirmed = await confirmDialog(
    "Block User",
    `Are you sure you want to block "${userName}"? They will no longer be able to log in.`
  );
  if (!confirmed) return;

  try {
    await apiFetch(`/admin/users/${userId}/block`, { method: "PATCH" });
    showToast(`"${userName}" has been blocked`);
    loadUsers(usersPage);
  } catch (err) {
    showToast(err.message || "Failed to block user", "error");
  }
};

// Unblock a user
window.handleUnblockUser = async function(userId, userName) {
  const confirmed = await confirmDialog(
    "Unblock User",
    `Unblock "${userName}"? They will be able to log in again.`
  );
  if (!confirmed) return;

  try {
    await apiFetch(`/admin/users/${userId}/unblock`, { method: "PATCH" });
    showToast(`"${userName}" has been unblocked`);
    loadUsers(usersPage);
  } catch (err) {
    showToast(err.message || "Failed to unblock user", "error");
  }
};

// Delete a user permanently
window.handleDeleteUser = async function(userId, userName) {
  const confirmed = await confirmDialog(
    "Delete User",
    `Permanently delete "${userName}" and all their listings? This CANNOT be undone.`
  );
  if (!confirmed) return;

  try {
    await apiFetch(`/admin/users/${userId}`, { method: "DELETE" });
    showToast(`"${userName}" deleted successfully`);
    loadUsers(usersPage);
  } catch (err) {
    showToast(err.message || "Failed to delete user", "error");
  }
};


// ═══════════════════════════════════════════════════════════
//  SECTION: MANAGE LISTINGS
// ═══════════════════════════════════════════════════════════
let listingsPage = 1;
const listingsPerPage = 15;

async function loadListings(page = 1) {
  listingsPage = page;
  const tableBody = document.getElementById("listings-table-body");
  const container = document.getElementById("listings-pagination");
  const status    = document.getElementById("listing-filter")?.value || "";

  tableBody.innerHTML = `
    <tr><td colspan="7" class="loading-state">
      <div class="spinner"></div><p>Loading listings...</p>
    </td></tr>`;

  try {
    const res = await apiFetch(`/admin/listings?page=${page}&limit=${listingsPerPage}&status=${status}`);
    const { listings, pagination } = res.data;

    if (!listings.length) {
      tableBody.innerHTML = `
        <tr><td colspan="7">
          <div class="empty-state">
            <div class="empty-icon">🏠</div>
            <p>No listings found</p>
          </div>
        </td></tr>`;
      return;
    }

    tableBody.innerHTML = listings.map(l => `
      <tr>
        <td>
          <div style="font-weight:600;color:#0a1628;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(l.title)}</div>
          <div style="font-size:0.75rem;color:#64748b">${escHtml(l.roomType?.replace(/_/g," "))}</div>
        </td>
        <td>
          <div class="user-cell-name">${escHtml(l.postedBy?.name || "Unknown")}</div>
          <div class="user-cell-email" style="font-size:0.74rem;color:#64748b">${escHtml(l.postedBy?.email || "")}</div>
        </td>
        <td class="col-hide-mobile">${escHtml(l.location?.city || "—")}</td>
        <td class="col-hide-mobile">₹${(l.rent?.amount || 0).toLocaleString()}</td>
        <td>${statusBadge(l.verificationStatus)}</td>
        <td class="col-hide-mobile">${formatDate(l.createdAt)}</td>
        <td>
          <div class="btn-actions">
            ${l.verificationStatus !== "verified"
              ? `<button class="btn-action btn-approve" onclick="handleVerifyListing('${l._id}')">✓ Verify</button>`
              : ""
            }
            ${l.verificationStatus !== "rejected"
              ? `<button class="btn-action btn-reject" onclick="handleRejectListing('${l._id}')">✗ Reject</button>`
              : ""
            }
            <button class="btn-action btn-delete" onclick="handleDeleteListing('${l._id}','${escHtml(l.title)}')">🗑</button>
          </div>
        </td>
      </tr>
    `).join("");

    renderPagination(container, pagination, (p) => loadListings(p));
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444;padding:20px">Failed to load listings</td></tr>`;
    showToast(err.message || "Failed to load listings", "error");
  }
}

window.handleVerifyListing = async function(listingId) {
  try {
    await apiFetch(`/admin/listings/${listingId}/verify`, { method: "PATCH" });
    showToast("Listing verified ✅");
    loadListings(listingsPage);
  } catch (err) {
    showToast(err.message || "Failed to verify listing", "error");
  }
};

window.handleRejectListing = async function(listingId) {
  const confirmed = await confirmDialog("Reject Listing", "Reject this listing? The owner will see it as rejected.");
  if (!confirmed) return;
  try {
    await apiFetch(`/admin/listings/${listingId}/reject`, { method: "PATCH" });
    showToast("Listing rejected");
    loadListings(listingsPage);
  } catch (err) {
    showToast(err.message || "Failed to reject listing", "error");
  }
};

window.handleDeleteListing = async function(listingId, title) {
  const confirmed = await confirmDialog("Delete Listing", `Permanently delete "${title}"? This cannot be undone.`);
  if (!confirmed) return;
  try {
    await apiFetch(`/admin/listings/${listingId}`, { method: "DELETE" });
    showToast("Listing deleted");
    loadListings(listingsPage);
  } catch (err) {
    showToast(err.message || "Failed to delete listing", "error");
  }
};


// ═══════════════════════════════════════════════════════════
//  SECTION: MANAGE REVIEWS
// ═══════════════════════════════════════════════════════════
let reviewsPage = 1;

async function loadReviews(page = 1) {
  reviewsPage = page;
  const tableBody = document.getElementById("reviews-table-body");
  const container = document.getElementById("reviews-pagination");

  tableBody.innerHTML = `
    <tr><td colspan="6" class="loading-state">
      <div class="spinner"></div><p>Loading reviews...</p>
    </td></tr>`;

  try {
    const res = await apiFetch(`/admin/reviews?page=${page}&limit=15`);
    const { reviews, pagination } = res.data;

    if (!reviews.length) {
      tableBody.innerHTML = `
        <tr><td colspan="6">
          <div class="empty-state"><div class="empty-icon">⭐</div><p>No reviews found</p></div>
        </td></tr>`;
      return;
    }

    tableBody.innerHTML = reviews.map(r => `
      <tr>
        <td>
          <div class="user-cell-name">${escHtml(r.reviewer?.name || "Unknown")}</div>
          <div style="font-size:0.74rem;color:#64748b">${escHtml(r.reviewer?.email || "")}</div>
        </td>
        <td class="col-hide-mobile">${escHtml(r.listing?.title || "Deleted listing")}</td>
        <td><span class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span> ${r.rating}/5</td>
        <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(r.comment || "")}</td>
        <td class="col-hide-mobile">${formatDate(r.createdAt)}</td>
        <td>
          <button class="btn-action btn-delete" onclick="handleDeleteReview('${r._id}')">🗑 Delete</button>
        </td>
      </tr>
    `).join("");

    renderPagination(container, pagination, (p) => loadReviews(p));
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:20px">Failed to load reviews</td></tr>`;
    showToast(err.message || "Failed to load reviews", "error");
  }
}

window.handleDeleteReview = async function(reviewId) {
  const confirmed = await confirmDialog("Delete Review", "Permanently delete this review?");
  if (!confirmed) return;
  try {
    await apiFetch(`/admin/reviews/${reviewId}`, { method: "DELETE" });
    showToast("Review deleted");
    loadReviews(reviewsPage);
  } catch (err) {
    showToast(err.message || "Failed to delete review", "error");
  }
};


// ═══════════════════════════════════════════════════════════
//  SECTION: REPORTS & COMPLAINTS  (v7.0 — enhanced)
// ═══════════════════════════════════════════════════════════

let reportsPage = 1;

// Reason labels with icons — mirrors report.js REPORT_REASONS
const REASON_LABELS = {
  fake_listing:          "🏚️ Fake Listing",
  spam:                  "📢 Spam",
  scam_fraud:            "🚨 Scam/Fraud",
  inappropriate_content: "🔞 Inappropriate",
  harassment:            "😡 Harassment",
  suspicious_user:       "🕵️ Suspicious User",
  misleading_info:       "⚠️ Misleading Info",
  abusive_behavior:      "😤 Abusive Behavior",
  other:                 "📝 Other",
};

// ── Load & render report stats cards ─────────────────────
async function loadReportStats() {
  try {
    // Fetch counts for each status in parallel
    const [pendingRes, resolvedRes, dismissedRes, allRes] = await Promise.all([
      apiFetch("/admin/reports?page=1&limit=1&status=pending"),
      apiFetch("/admin/reports?page=1&limit=1&status=resolved"),
      apiFetch("/admin/reports?page=1&limit=1&status=dismissed"),
      apiFetch("/admin/reports?page=1&limit=1&status=all"),
    ]);

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val ?? "0";
    };

    set("rStatPending",   pendingRes.data?.pagination?.total);
    set("rStatResolved",  resolvedRes.data?.pagination?.total);
    set("rStatDismissed", dismissedRes.data?.pagination?.total);
    set("rStatTotal",     allRes.data?.pagination?.total);
  } catch (err) {
    // Stats cards are non-critical — fail silently
    console.warn("Could not load report stats:", err.message);
  }
}

// ── Main load function ────────────────────────────────────
async function loadReports(page = 1) {
  reportsPage = page;
  const tableBody  = document.getElementById("reports-table-body");
  const container  = document.getElementById("reports-pagination");
  const countLabel = document.getElementById("reportFilterCount");
  const status     = document.getElementById("report-filter")?.value || "pending";

  tableBody.innerHTML = `
    <tr><td colspan="8" class="loading-state">
      <div class="spinner"></div><p>Loading reports...</p>
    </td></tr>`;

  // Load stats cards in parallel (non-blocking)
  loadReportStats();

  try {
    const res = await apiFetch(`/admin/reports?page=${page}&limit=15&status=${status}`);
    const { reports, pagination } = res.data;

    // Update count label
    if (countLabel) {
      countLabel.textContent = pagination.total
        ? `${pagination.total} report${pagination.total !== 1 ? "s" : ""} found`
        : "";
    }

    if (!reports.length) {
      tableBody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty-state">
            <div class="empty-icon">🚩</div>
            <p>No ${status === "all" ? "" : status + " "}reports found</p>
          </div>
        </td></tr>`;
      return;
    }

    tableBody.innerHTML = reports.map(r => {
      const reasonLabel = REASON_LABELS[r.reason] || escHtml(r.reason?.replace(/_/g, " ") || "");
      const targetName  = r.targetType === "listing"
        ? escHtml(r.targetListing?.title || "Deleted listing")
        : escHtml(r.targetUser?.name    || "Deleted user");
      const targetBadgeCls = r.targetType === "listing" ? "badge-pending" : "badge-user";
      const shortDesc   = (r.description || "").length > 60
        ? escHtml(r.description.substring(0, 60)) + "…"
        : escHtml(r.description || "—");

      // Status badge
      let statusBadge;
      if (r.status === "pending") {
        statusBadge = `<span class="badge badge-pending-report">⏳ Pending</span>`;
      } else if (r.status === "resolved") {
        statusBadge = `<span class="badge badge-resolved-report">✅ Resolved</span>`;
      } else {
        statusBadge = `<span class="badge badge-dismissed-report">🚫 Dismissed</span>`;
      }

      // Action buttons
      let actionBtns;
      if (r.status === "pending") {
        actionBtns = `
          <div class="btn-actions" style="flex-direction:column;gap:5px;align-items:flex-start;">
            <div style="display:flex;gap:5px;">
              <button class="btn-action btn-resolve"
                onclick="handleResolveReport('${r._id}','resolved')">✓ Resolve</button>
              <button class="btn-action btn-dismiss"
                onclick="handleResolveReport('${r._id}','dismissed')">Dismiss</button>
            </div>
            <div style="display:flex;gap:5px;">
              ${r.targetType === "listing" && r.targetListing?._id
                ? `<button class="btn-action-delete"
                     onclick="handleDeleteReportedListing('${r._id}','${r.targetListing._id}')">
                     🗑 Del Listing</button>`
                : ""}
              ${r.targetType === "user" && r.targetUser?._id
                ? `<button class="btn-action-suspend"
                     onclick="handleSuspendUser('${r._id}','${r.targetUser._id}','${escHtml(r.targetUser.name || "User")}')">
                     ⛔ Suspend</button>`
                : ""}
              <button class="btn-action-delete"
                onclick="handleDeleteReport('${r._id}')">
                🗑 Del Report</button>
            </div>
          </div>`;
      } else {
        actionBtns = `
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button class="btn-action-delete"
              onclick="handleDeleteReport('${r._id}')">🗑 Delete</button>
          </div>`;
      }

      return `
        <tr>
          <td>
            <div class="user-cell-name">${escHtml(r.reportedBy?.name || "Unknown")}</div>
            <div style="font-size:0.74rem;color:#64748b">${escHtml(r.reportedBy?.email || "")}</div>
          </td>
          <td>
            <span class="badge ${targetBadgeCls}">${r.targetType}</span>
          </td>
          <td class="col-hide-mobile" style="max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${targetName}
          </td>
          <td>
            <span class="reason-label">${reasonLabel}</span>
          </td>
          <td class="col-hide-mobile report-desc-cell">
            ${shortDesc}
            ${(r.description || "").length > 60
              ? `<br><button class="report-expand-btn"
                   onclick="toggleReportDetail('detail-${r._id}')">View more</button>
                 <div id="detail-${r._id}" class="report-detail-panel">
                   ${escHtml(r.description)}
                 </div>`
              : ""}
          </td>
          <td class="col-hide-mobile" style="white-space:nowrap;font-size:0.8rem;">
            ${formatDate(r.createdAt)}
          </td>
          <td>${statusBadge}</td>
          <td>${actionBtns}</td>
        </tr>`;
    }).join("");

    renderPagination(container, pagination, (p) => loadReports(p));
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ef4444;padding:24px;">
      ⚠️ Failed to load reports — ${escHtml(err.message)}
    </td></tr>`;
    showToast(err.message || "Failed to load reports", "error");
  }
}

// ── Toggle expandable description panel ──────────────────
window.toggleReportDetail = function(detailId) {
  const panel = document.getElementById(detailId);
  if (!panel) return;
  panel.classList.toggle("open");
  const btn = panel.previousElementSibling;
  if (btn) btn.textContent = panel.classList.contains("open") ? "View less" : "View more";
};

// ── Resolve / Dismiss ─────────────────────────────────────
window.handleResolveReport = async function(reportId, action) {
  try {
    await apiFetch(`/admin/reports/${reportId}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    showToast(`Report marked as ${action} ✓`);
    loadReports(reportsPage);
    loadStats();
  } catch (err) {
    showToast(err.message || "Failed to update report", "error");
  }
};

// ── Delete report record ──────────────────────────────────
window.handleDeleteReport = function(reportId) {
  openConfirm(
    "Delete Report?",
    "This will permanently remove the report record. This cannot be undone.",
    async () => {
      try {
        await apiFetch(`/admin/reports/${reportId}`, { method: "DELETE" });
        showToast("Report deleted successfully");
        loadReports(reportsPage);
        loadReportStats();
      } catch (err) {
        showToast(err.message || "Failed to delete report", "error");
      }
    }
  );
};

// ── Delete the reported listing ───────────────────────────
window.handleDeleteReportedListing = function(reportId, listingId) {
  openConfirm(
    "Delete Reported Listing?",
    "This will permanently delete the listing AND resolve the report. Confirm to proceed.",
    async () => {
      try {
        await apiFetch(`/admin/listings/${listingId}`, { method: "DELETE" });
        await apiFetch(`/admin/reports/${reportId}/resolve`, {
          method: "PATCH",
          body: JSON.stringify({ action: "resolved" }),
        });
        showToast("Listing deleted and report resolved ✓");
        loadReports(reportsPage);
        loadReportStats();
        loadStats();
      } catch (err) {
        showToast(err.message || "Failed to delete listing", "error");
      }
    }
  );
};

// ── Suspend user (demo: blocks the user) ─────────────────
window.handleSuspendUser = function(reportId, userId, userName) {
  openConfirm(
    `Suspend "${userName}"?`,
    "This will block the user's account. They will not be able to log in until reinstated. The report will be marked as resolved.",
    async () => {
      try {
        await apiFetch(`/admin/users/${userId}/block`, { method: "PATCH" });
        await apiFetch(`/admin/reports/${reportId}/resolve`, {
          method: "PATCH",
          body: JSON.stringify({ action: "resolved" }),
        });
        showToast(`User "${userName}" has been suspended ✓`);
        loadReports(reportsPage);
        loadReportStats();
        loadStats();
      } catch (err) {
        showToast(err.message || "Failed to suspend user", "error");
      }
    }
  );
};


// ═══════════════════════════════════════════════════════════
//  SECTION: VERIFICATION REQUESTS
//  (Pending listings waiting for admin approval)
// ═══════════════════════════════════════════════════════════
async function loadVerifications() {
  // Reuse the loadListings function but filtered to "pending"
  const container = document.getElementById("verif-table-body");
  const pagCtrl   = document.getElementById("verif-pagination");

  if (!container) return;

  container.innerHTML = `
    <tr><td colspan="6" class="loading-state">
      <div class="spinner"></div><p>Loading pending verifications...</p>
    </td></tr>`;

  try {
    const res = await apiFetch("/admin/listings?status=pending&limit=20");
    const { listings, pagination } = res.data;

    if (!listings.length) {
      container.innerHTML = `
        <tr><td colspan="6">
          <div class="empty-state"><div class="empty-icon">🎉</div><p>No pending verifications — all caught up!</p></div>
        </td></tr>`;
      return;
    }

    container.innerHTML = listings.map(l => `
      <tr>
        <td>
          <div style="font-weight:600;color:#0a1628">${escHtml(l.title)}</div>
          <div style="font-size:0.74rem;color:#64748b">${escHtml(l.roomType?.replace(/_/g," "))}</div>
        </td>
        <td>${escHtml(l.postedBy?.name || "Unknown")}</td>
        <td class="col-hide-mobile">${escHtml(l.location?.city || "—")}</td>
        <td class="col-hide-mobile">₹${(l.rent?.amount || 0).toLocaleString()}/mo</td>
        <td class="col-hide-mobile">${formatDate(l.createdAt)}</td>
        <td>
          <div class="btn-actions">
            <button class="btn-action btn-approve" onclick="handleVerifyListing('${l._id}');loadVerifications()">✓ Approve</button>
            <button class="btn-action btn-reject"  onclick="handleRejectListing('${l._id}');setTimeout(loadVerifications,500)">✗ Reject</button>
          </div>
        </td>
      </tr>
    `).join("");

    renderPagination(pagCtrl, pagination, () => loadVerifications());
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ef4444;padding:20px">Failed to load verifications</td></tr>`;
  }
}


// ─── SHARED UTILITY FUNCTIONS ────────────────────────────────

// Build pagination controls
function renderPagination(container, pagination, onPageChange) {
  if (!container || !pagination) return;
  const { total, page, limit, pages } = pagination;
  const start = (page - 1) * limit + 1;
  const end   = Math.min(page * limit, total);

  container.innerHTML = `
    <span>Showing ${start}–${end} of ${total}</span>
    <div class="pagination-btns">
      <button class="page-btn" onclick="(${onPageChange.toString()})(${page - 1})" ${page <= 1 ? "disabled" : ""}>← Prev</button>
      <button class="page-btn" onclick="(${onPageChange.toString()})(${page + 1})" ${page >= pages ? "disabled" : ""}>Next →</button>
    </div>
  `;
}

// Format date nicely: "Jan 15, 2025"
function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-IN", {
    year: "numeric", month: "short", day: "numeric"
  });
}

// Escape HTML to prevent XSS (never trust user data!)
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Return a colored badge for listing verification status
function statusBadge(status) {
  const map = {
    pending:  '<span class="badge badge-pending">⏳ Pending</span>',
    verified: '<span class="badge badge-verified">✅ Verified</span>',
    rejected: '<span class="badge badge-rejected">❌ Rejected</span>',
  };
  return map[status] || status;
}

// Logout
window.adminLogout = function() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = "./login.html";
};


// ─── SEARCH & FILTER LISTENERS ──────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  // User search — trigger on Enter key or after 500ms pause
  const userSearch = document.getElementById("user-search");
  if (userSearch) {
    let debounce;
    userSearch.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => loadUsers(1), 500);
    });
  }

  // Listing status filter dropdown
  const listingFilter = document.getElementById("listing-filter");
  if (listingFilter) {
    listingFilter.addEventListener("change", () => loadListings(1));
  }

  // Initialize navigation (must be last)
  initNavigation();
});
