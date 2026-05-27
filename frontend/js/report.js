// frontend/js/report.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Report & Safety System  (v7.0)
//
//  WHAT THIS FILE DOES:
//  ─────────────────────────────────────────────────────────
//  ✅ Injects the report modal HTML once into the DOM
//  ✅ Provides openReportModal(targetType, targetId, targetName)
//  ✅ Reason selection with icons
//  ✅ Optional description textarea with char counter
//  ✅ Validation + loading state on submit
//  ✅ POST /api/reports to backend
//  ✅ Rich toast notifications (success / error)
//  ✅ Safety badge helpers: renderVerifiedBadge(), renderTrustScore()
//  ✅ Works on: listings.html, matchings.html, chat.html, profile.html
//  ✅ Falls back gracefully if user is not logged in
// ═══════════════════════════════════════════════════════════

"use strict";

// ─────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────
const REPORT_API_BASE = "http://localhost:5000/api";
const REPORT_TOKEN_KEY = "findmate_token";

// ─────────────────────────────────────────────────────────
//  REPORT REASONS
// ─────────────────────────────────────────────────────────
const REPORT_REASONS = [
  { value: "fake_listing",         icon: "🏚️",  label: "Fake Listing" },
  { value: "spam",                 icon: "📢",  label: "Spam" },
  { value: "scam_fraud",           icon: "🚨",  label: "Scam / Fraud" },
  { value: "inappropriate_content",icon: "🔞",  label: "Inappropriate Content" },
  { value: "harassment",           icon: "😡",  label: "Harassment" },
  { value: "suspicious_user",      icon: "🕵️",  label: "Suspicious User" },
  { value: "misleading_info",      icon: "⚠️",  label: "Misleading Info" },
  { value: "other",                icon: "📝",  label: "Other" },
];

// ─────────────────────────────────────────────────────────
//  INTERNAL STATE
// ─────────────────────────────────────────────────────────
let _currentTargetType = null;   // "listing" | "user"
let _currentTargetId   = null;
let _currentTargetName = "";
let _selectedReason    = null;
let _isSubmitting      = false;

// ═══════════════════════════════════════════════════════════
//  MODAL HTML INJECTION
//  Called once on DOMContentLoaded — adds the modal overlay
//  and toast container to the page body.
// ═══════════════════════════════════════════════════════════
function _injectReportModal() {
  // Prevent double injection
  if (document.getElementById("reportModalOverlay")) return;

  // ── Toast container ──────────────────────────────────────
  const toastContainer = document.createElement("div");
  toastContainer.className = "report-toast-container";
  toastContainer.id = "reportToastContainer";
  document.body.appendChild(toastContainer);

  // ── Modal overlay ────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.id        = "reportModalOverlay";
  overlay.className = "report-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "reportModalTitle");

  // Build reason buttons HTML
  const reasonBtnsHtml = REPORT_REASONS.map(r => `
    <button
      type="button"
      class="report-reason-btn"
      data-value="${r.value}"
      onclick="reportSelectReason('${r.value}', this)"
      aria-pressed="false"
    >
      <span class="report-reason-icon" aria-hidden="true">${r.icon}</span>
      ${r.label}
    </button>
  `).join("");

  overlay.innerHTML = `
    <div class="report-modal" role="document">

      <!-- Header -->
      <div class="report-modal-header">
        <div class="report-modal-header-left">
          <div class="report-modal-icon" aria-hidden="true">🚩</div>
          <div>
            <h2 class="report-modal-title" id="reportModalTitle">Report Content</h2>
            <div class="report-modal-subtitle" id="reportModalSubtitle">Help us keep FindMate safe</div>
          </div>
        </div>
        <button
          class="report-modal-close"
          onclick="closeReportModal()"
          aria-label="Close report dialog"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="report-modal-body">

        <!-- Target info pill -->
        <div class="report-target-pill" id="reportTargetPill">
          <span class="report-target-pill-icon" id="reportTargetIcon" aria-hidden="true">📋</span>
          <div>
            <div style="font-size:0.73rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:1px;">Reporting</div>
            <div class="report-target-pill-name" id="reportTargetName">—</div>
          </div>
        </div>

        <!-- Reason selection -->
        <label class="report-field-label">Select a reason <span style="color:#ef4444;">*</span></label>
        <div class="report-reasons-grid" role="group" aria-label="Report reason">
          ${reasonBtnsHtml}
        </div>
        <div class="report-error-msg" id="reportReasonError">
          ⚠️ Please select a reason before submitting.
        </div>

        <!-- Description -->
        <label class="report-field-label" for="reportDescription" style="margin-top:4px;">
          Additional details <span style="font-weight:400;color:#94a3b8;">(optional)</span>
        </label>
        <textarea
          id="reportDescription"
          class="report-textarea"
          placeholder="Describe the issue in more detail… (max 500 characters)"
          maxlength="500"
          rows="3"
          oninput="reportUpdateCharCount(this)"
        ></textarea>
        <div class="report-char-count"><span id="reportCharCount">0</span> / 500</div>

      </div><!-- /.report-modal-body -->

      <!-- Footer -->
      <div class="report-modal-footer">
        <button type="button" class="report-btn-cancel" onclick="closeReportModal()">
          Cancel
        </button>
        <button
          type="button"
          class="report-btn-submit"
          id="reportSubmitBtn"
          onclick="submitReport()"
        >
          <div class="report-spinner" id="reportSpinner" aria-hidden="true"></div>
          <span class="report-btn-text">Submit Report</span>
        </button>
      </div>

    </div><!-- /.report-modal -->
  `;

  // Close on backdrop click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeReportModal();
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("active")) {
      closeReportModal();
    }
  });

  document.body.appendChild(overlay);
}


// ═══════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════

/**
 * Open the report modal.
 *
 * @param {"listing"|"user"} targetType - What is being reported
 * @param {string}           targetId   - MongoDB _id of the target
 * @param {string}           targetName - Display name for the target
 */
window.openReportModal = function(targetType, targetId, targetName) {
  // Check user is logged in
  const token = localStorage.getItem(REPORT_TOKEN_KEY);
  if (!token) {
    showReportToast("Please sign in to report content.", "warning");
    setTimeout(() => { window.location.href = "./login.html"; }, 1200);
    return;
  }

  _currentTargetType = targetType;
  _currentTargetId   = targetId;
  _currentTargetName = targetName || "Unknown";
  _selectedReason    = null;
  _isSubmitting      = false;

  // Reset UI
  _resetModalUI();

  // Update target pill
  const targetIcon = document.getElementById("reportTargetIcon");
  const targetNameEl = document.getElementById("reportTargetName");
  const subtitleEl   = document.getElementById("reportModalSubtitle");

  if (targetType === "listing") {
    if (targetIcon) targetIcon.textContent = "🏠";
    if (subtitleEl) subtitleEl.textContent = "Report a listing";
  } else {
    if (targetIcon) targetIcon.textContent = "👤";
    if (subtitleEl) subtitleEl.textContent = "Report a user";
  }

  if (targetNameEl) targetNameEl.textContent = _currentTargetName;

  // Show overlay
  const overlay = document.getElementById("reportModalOverlay");
  if (overlay) {
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
    // Focus first reason button for accessibility
    setTimeout(() => {
      const firstBtn = overlay.querySelector(".report-reason-btn");
      if (firstBtn) firstBtn.focus();
    }, 320);
  }
};

/** Close the modal and reset state */
window.closeReportModal = function() {
  const overlay = document.getElementById("reportModalOverlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
  document.body.style.overflow = "";
  _selectedReason = null;
  _isSubmitting   = false;
};

/** Handle reason button clicks */
window.reportSelectReason = function(value, btn) {
  _selectedReason = value;

  // Deselect all
  document.querySelectorAll(".report-reason-btn").forEach(b => {
    b.classList.remove("selected");
    b.setAttribute("aria-pressed", "false");
  });

  // Select clicked
  btn.classList.add("selected");
  btn.setAttribute("aria-pressed", "true");

  // Hide error
  const errEl = document.getElementById("reportReasonError");
  if (errEl) errEl.classList.remove("show");
};

/** Update character count below textarea */
window.reportUpdateCharCount = function(textarea) {
  const countEl = document.getElementById("reportCharCount");
  if (countEl) countEl.textContent = textarea.value.length;
};

/** Submit the report to the API */
window.submitReport = async function() {
  if (_isSubmitting) return;

  // Validate reason
  if (!_selectedReason) {
    const errEl = document.getElementById("reportReasonError");
    if (errEl) errEl.classList.add("show");
    return;
  }

  const description = (document.getElementById("reportDescription")?.value || "").trim();
  const token       = localStorage.getItem(REPORT_TOKEN_KEY);

  if (!token) {
    showReportToast("Session expired. Please sign in again.", "error");
    return;
  }

  _isSubmitting = true;
  _setSubmitLoading(true);

  try {
    const body = {
      targetType:    _currentTargetType,
      reason:        _selectedReason,
      description:   description,
    };

    if (_currentTargetType === "listing") {
      body.targetListing = _currentTargetId;
    } else {
      body.targetUser = _currentTargetId;
    }

    const res = await fetch(`${REPORT_API_BASE}/reports`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      closeReportModal();
      showReportToast("✅ Report submitted successfully. Our team will review it shortly.", "success");
    } else {
      throw new Error(data.message || "Failed to submit report");
    }
  } catch (err) {
    showReportToast(err.message || "Something went wrong. Please try again.", "error");
  } finally {
    _isSubmitting = false;
    _setSubmitLoading(false);
  }
};


// ═══════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

/**
 * Show a toast notification.
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} type
 * @param {number} duration - ms before auto-dismiss (default 4000)
 */
window.showReportToast = function(message, type = "success", duration = 4500) {
  const container = document.getElementById("reportToastContainer");
  if (!container) return;

  const icons = {
    success: "✅",
    error:   "❌",
    warning: "⚠️",
    info:    "ℹ️",
  };

  const toast = document.createElement("div");
  toast.className = `report-toast ${type}`;
  toast.innerHTML = `
    <span class="report-toast-icon" aria-hidden="true">${icons[type] || "ℹ️"}</span>
    <span class="report-toast-msg">${message}</span>
    <button class="report-toast-close" aria-label="Dismiss notification" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    if (!toast.isConnected) return;
    toast.classList.add("leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
    // Fallback in case animationend doesn't fire
    setTimeout(() => { if (toast.isConnected) toast.remove(); }, 350);
  }, duration);
};


// ═══════════════════════════════════════════════════════════
//  SAFETY BADGE HELPERS
//  These return HTML strings that can be injected into cards,
//  headers, and detail views.
// ═══════════════════════════════════════════════════════════

/**
 * Returns a "Verified User" badge HTML string.
 * @param {boolean} isVerified
 */
window.renderVerifiedBadge = function(isVerified) {
  if (!isVerified) return "";
  return `<span class="safety-badge safety-badge-verified" title="This user is verified by FindMate">
    ✓ Verified
  </span>`;
};

/**
 * Returns a "Safe Listing" badge HTML.
 * @param {boolean} isSafe
 */
window.renderSafeBadge = function(isSafe) {
  if (!isSafe) return "";
  return `<span class="safety-badge safety-badge-safe" title="No reports on this listing">
    🛡 Safe Listing
  </span>`;
};

/**
 * Returns a warning badge for reported listings.
 * @param {number} reportCount
 */
window.renderWarningBadge = function(reportCount) {
  if (!reportCount || reportCount < 1) return "";
  return `<span class="safety-badge safety-badge-warning" title="This listing has been reported ${reportCount} time(s)">
    ⚠️ Reported
  </span>`;
};

/**
 * Renders a trust score widget (ring + label).
 * Score is 0-100.  Computed as demo from listing/user data.
 *
 * @param {number} score - 0 to 100
 * @param {string} label - e.g. "Trust Score"
 */
window.renderTrustScoreWidget = function(score, label = "Trust Score") {
  const clampedScore = Math.max(0, Math.min(100, score));
  const circumference = 138.23; // 2π × 22
  const offset = circumference - (clampedScore / 100) * circumference;

  // Color based on score
  let ringColor = "#00c9a7";
  let scoreLabel = "Great";
  if (clampedScore < 40) { ringColor = "#ef4444"; scoreLabel = "Low"; }
  else if (clampedScore < 70) { ringColor = "#f59e0b"; scoreLabel = "Fair"; }
  else if (clampedScore >= 90) { scoreLabel = "Excellent"; }

  return `
    <div class="trust-score-widget">
      <div class="trust-ring" title="${label}: ${clampedScore}/100">
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle class="trust-ring-track" cx="26" cy="26" r="22"/>
          <circle
            class="trust-ring-fill"
            cx="26" cy="26" r="22"
            stroke="${ringColor}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${offset}"
          />
        </svg>
        <div class="trust-ring-label">${clampedScore}</div>
      </div>
      <div>
        <div class="trust-score-info-title">${label}</div>
        <div class="trust-score-info-sub">${scoreLabel} — based on activity &amp; reports</div>
      </div>
    </div>
  `;
};

/**
 * Compute a demo trust score for a listing.
 * Uses: views, availability, postedBy verification, etc.
 * In production this would come from the server.
 */
window.computeListingTrustScore = function(listing) {
  if (!listing) return 60;
  let score = 70; // baseline
  if (listing.views > 20)         score += 8;
  if (listing.image)              score += 6;
  if (listing.description?.length > 80) score += 5;
  if (listing.amenities?.length > 2)    score += 5;
  if (listing.contactNumber)      score += 4;
  if (listing.googleMapLink)      score += 4;
  if (listing.rent?.isNegotiable) score -= 2; // minor negative signal
  return Math.min(score, 98);
};

/**
 * Compute a demo trust score for a user.
 */
window.computeUserTrustScore = function(user) {
  if (!user) return 60;
  let score = 65;
  if (user.name?.length > 4)   score += 8;
  if (user.email)              score += 7;
  if (user.role === "admin")   score = 99;
  return Math.min(score, 98);
};


// ═══════════════════════════════════════════════════════════
//  PRIVATE HELPERS
// ═══════════════════════════════════════════════════════════

function _resetModalUI() {
  // Deselect all reasons
  document.querySelectorAll(".report-reason-btn").forEach(b => {
    b.classList.remove("selected");
    b.setAttribute("aria-pressed", "false");
  });

  // Clear textarea + counter
  const ta = document.getElementById("reportDescription");
  if (ta) ta.value = "";
  const cc = document.getElementById("reportCharCount");
  if (cc) cc.textContent = "0";

  // Hide error
  const errEl = document.getElementById("reportReasonError");
  if (errEl) errEl.classList.remove("show");

  // Reset submit button
  _setSubmitLoading(false);
}

function _setSubmitLoading(loading) {
  const btn     = document.getElementById("reportSubmitBtn");
  const spinner = document.getElementById("reportSpinner");
  const btnText = btn?.querySelector(".report-btn-text");

  if (!btn) return;

  if (loading) {
    btn.classList.add("loading");
    btn.disabled = true;
    if (spinner) spinner.style.display = "block";
    if (btnText) btnText.textContent = "Submitting…";
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
    if (spinner) spinner.style.display = "none";
    if (btnText) btnText.textContent = "Submit Report";
  }
}


// ═══════════════════════════════════════════════════════════
//  INIT — inject modal on DOM ready
// ═══════════════════════════════════════════════════════════
(function init() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _injectReportModal);
  } else {
    _injectReportModal();
  }
})();
