// frontend/js/reviews.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Reviews & Ratings System  (NEW v4.0)
//
//  This file is loaded on listings.html.
//  It is called by listings.js after openDetail() renders
//  the listing detail panel.
//
//  PUBLIC FUNCTIONS (called from listings.js):
//  ─────────────────────────────────────────────
//  loadReviews(listingId)
//    → Fetches reviews from the API and renders them
//      inside #reviewsSection (already in the DOM by the
//      time this is called).
//
//  INTERNAL FUNCTIONS:
//  ─────────────────────────────────────────────
//  renderReviewsSection(listingId, data)  → builds full section HTML
//  initStarPicker()                        → attaches hover/click events
//  submitReview(listingId)                 → POST to /api/reviews/:id
//  deleteReview(reviewId, listingId)       → DELETE /api/reviews/:id
//  buildStarsSVG(rating, size)             → returns filled star SVGs
//  formatDate(dateStr)                     → "12 Jan 2025"
//  getRatingLabel(rating)                  → "Very Good" etc.
// ═══════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────
//  CONFIG — must match the backend server URL
// ─────────────────────────────────────────────────────────
const REVIEWS_API = window.APP_CONFIG.API_BASE + "/reviews";


// ─────────────────────────────────────────────────────────
//  AUTH STATE — read from localStorage
//  (Same tokens set by login.js when user signed in)
// ─────────────────────────────────────────────────────────
function getAuthToken() {
  return localStorage.getItem("findmate_token");
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem("findmate_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}


// ─────────────────────────────────────────────────────────
//  STAR SVG BUILDER
//  ─────────────────────────────────────────────────────────
//  Builds a row of star SVG icons for READ-ONLY display
//  (used in the summary banner and on review cards).
//
//  @param {number} rating   — the rating value (e.g. 4.3)
//  @param {string} sizeClass — CSS class: "star-display" or "star-small"
//  @returns {string}  HTML string of 5 star SVGs
// ─────────────────────────────────────────────────────────

// SVG path for a standard 5-pointed star shape
const STAR_PATH = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

function buildStarsSVG(rating, sizeClass = "star-display") {
  let html = "";

  for (let i = 1; i <= 5; i++) {
    let starClass;

    if (i <= Math.floor(rating)) {
      // Full star — rating 4.3 → stars 1,2,3,4 are full
      starClass = "full";
    } else if (i === Math.ceil(rating) && rating % 1 >= 0.4) {
      // Half star — e.g. 4.3 → star 5 could be half
      // We simplify: if the decimal part ≥ 0.5 show full, else empty
      starClass = rating % 1 >= 0.5 ? "full" : "empty";
    } else {
      // Empty star
      starClass = "empty";
    }

    html += `
      <svg class="${sizeClass} ${starClass}"
           viewBox="0 0 24 24"
           fill="currentColor"
           stroke="currentColor"
           stroke-width="1"
           aria-hidden="true">
        <path d="${STAR_PATH}"/>
      </svg>`;
  }

  return html;
}


// ─────────────────────────────────────────────────────────
//  RATING LABEL TEXT
//  Maps a numeric rating to a human-readable label.
// ─────────────────────────────────────────────────────────
function getRatingLabel(rating) {
  if (rating >= 4.5) return "Excellent";
  if (rating >= 3.5) return "Very Good";
  if (rating >= 2.5) return "Good";
  if (rating >= 1.5) return "Fair";
  return "Poor";
}


// ─────────────────────────────────────────────────────────
//  DATE FORMATTER
//  Converts ISO date string to "12 Jan 2025"
// ─────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day:   "numeric",
    month: "short",
    year:  "numeric",
  });
}


// ─────────────────────────────────────────────────────────
//  escapeHtml — prevent XSS in user-generated content
// ─────────────────────────────────────────────────────────
function escReview(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ─────────────────────────────────────────────────────────
//  LOAD REVIEWS (main entry point — called by listings.js)
//  ─────────────────────────────────────────────────────────
//  Fetches review data from the API for a given listing,
//  then renders everything into #reviewsSection.
//
//  @param {string} listingId — MongoDB _id of the listing
// ─────────────────────────────────────────────────────────
async function loadReviews(listingId) {
  const section = document.getElementById("reviewsSection");
  if (!section) return; // safety: reviews section not in DOM yet

  // ── Show loading skeletons while fetching ──────────────
  section.innerHTML = buildLoadingSkeleton();

  try {
    // Fetch all reviews + stats from the backend
    const response = await fetch(`${REVIEWS_API}/${listingId}`);
    const data     = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to load reviews");
    }

    // Render the full reviews section with the fetched data
    renderReviewsSection(listingId, data.data);

  } catch (error) {
    console.error("Load reviews error:", error);
    section.innerHTML = `
      <div class="reviews-section">
        <div class="reviews-heading"><h3>Reviews</h3></div>
        <p style="color:var(--text-light); font-size:0.875rem;">
          Could not load reviews. ${escReview(error.message)}
        </p>
      </div>`;
  }
}


// ─────────────────────────────────────────────────────────
//  RENDER FULL REVIEWS SECTION
//  Builds and injects all the HTML for:
//  - Rating summary banner
//  - Write-a-review form (if logged in & not yet reviewed)
//  - List of review cards
// ─────────────────────────────────────────────────────────
function renderReviewsSection(listingId, data) {
  const section     = document.getElementById("reviewsSection");
  const reviews     = data.reviews  || [];
  const stats       = data.stats    || { totalReviews: 0, averageRating: 0, distribution: {} };
  const currentUser = getCurrentUser();
  const token       = getAuthToken();

  // Has this user already reviewed this listing?
  const alreadyReviewed = currentUser && reviews.some(
    r => (r.reviewer?._id || r.reviewer) === (currentUser._id || currentUser.id)
  );

  // ── Build HTML ─────────────────────────────────────────
  section.innerHTML = `
    <div class="reviews-section">

      <!-- ── Heading ── -->
      <div class="reviews-heading">
        <h3>Reviews</h3>
        ${stats.totalReviews > 0
          ? `<span class="reviews-count-badge">${stats.totalReviews} review${stats.totalReviews !== 1 ? "s" : ""}</span>`
          : ""}
      </div>

      <!-- ── Rating Summary Banner ── -->
      ${stats.totalReviews > 0 ? buildRatingSummary(stats) : ""}

      <!-- ── Write a Review ── -->
      ${buildReviewFormArea(listingId, token, alreadyReviewed)}

      <!-- ── Review Cards ── -->
      <div class="reviews-list" id="reviewsList">
        ${reviews.length > 0
          ? reviews.map(r => buildReviewCard(r, currentUser)).join("")
          : buildEmptyState(token)}
      </div>

    </div>`;

  // ── After HTML is injected, attach event listeners ────
  // (can't attach events to elements before they exist in the DOM)
  initStarPicker();
  initReviewForm(listingId);
}


// ─────────────────────────────────────────────────────────
//  BUILD RATING SUMMARY BANNER
// ─────────────────────────────────────────────────────────
function buildRatingSummary(stats) {
  const avg   = stats.averageRating || 0;
  const label = getRatingLabel(avg);
  const dist  = stats.distribution || {};
  const total = stats.totalReviews || 1; // avoid divide-by-zero

  // Distribution rows: 5 stars down to 1 star
  const distRows = [5, 4, 3, 2, 1].map(star => {
    const count   = dist[star] || 0;
    const pct     = Math.round((count / total) * 100);
    return `
      <div class="dist-row">
        <span class="dist-label">${star} ★</span>
        <div class="dist-bar-track">
          <div class="dist-bar-fill" style="width: ${pct}%"></div>
        </div>
        <span class="dist-count">${count}</span>
      </div>`;
  }).join("");

  return `
    <div class="rating-summary">
      <!-- Big number -->
      <div class="rating-big-num" aria-label="${avg} out of 5">${avg.toFixed(1)}</div>

      <!-- Stars + label -->
      <div class="rating-summary-mid">
        <div class="stars-display" aria-hidden="true">
          ${buildStarsSVG(avg, "star-display")}
        </div>
        <span class="rating-label">${label}</span>
        <span style="font-size:0.78rem; color:var(--text-light);">
          Based on ${stats.totalReviews} review${stats.totalReviews !== 1 ? "s" : ""}
        </span>
      </div>

      <!-- Distribution bars -->
      <div class="rating-distribution" aria-label="Rating breakdown">
        ${distRows}
      </div>
    </div>`;
}


// ─────────────────────────────────────────────────────────
//  BUILD REVIEW FORM AREA
//  Shows one of three states:
//  A. Not logged in          → login prompt
//  B. Already reviewed        → "you've already reviewed" notice
//  C. Logged in, not reviewed → the review form
// ─────────────────────────────────────────────────────────
function buildReviewFormArea(listingId, token, alreadyReviewed) {
  // A. Not logged in
  if (!token) {
    return `
      <div class="review-login-prompt">
        <p>📝 Have experience with this listing? <strong>Sign in</strong> to share your review.</p>
        <a href="./login.html">Sign In</a>
      </div>`;
  }

  // B. Already reviewed
  if (alreadyReviewed) {
    return `
      <div class="review-already-done">
        ✅ You've already reviewed this listing.
      </div>`;
  }

  // C. Show the form
  // The star buttons each have data-value="1" through data-value="5"
  // JS picks up those values in initStarPicker()
  const stars = [1, 2, 3, 4, 5].map(n => `
    <button
      type="button"
      class="star-btn"
      data-value="${n}"
      aria-label="${n} star${n !== 1 ? "s" : ""}"
      title="${n} – ${getRatingLabel(n)}"
    >
      <svg class="star-empty" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
        <path d="${STAR_PATH}"/>
      </svg>
    </button>`).join("");

  return `
    <div class="review-form-wrapper">
      <div class="review-form-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
        </svg>
        Write a Review
      </div>

      <!-- Star picker -->
      <div class="star-picker-group" id="starPickerGroup">
        <span class="star-picker-label">Your Rating <span style="color:var(--error)">*</span></span>
        <div class="star-picker" id="starPicker" role="group" aria-label="Select rating">
          ${stars}
          <span class="star-picker-hint" id="starHint">Click a star to rate</span>
        </div>
      </div>

      <!-- Hidden input carries the selected numeric value -->
      <input type="hidden" id="selectedRating" value="" />

      <!-- Comment textarea -->
      <div class="review-comment-group">
        <label class="review-comment-label" for="reviewComment">
          Your Comment <span style="color:var(--error)">*</span>
          <span class="review-comment-count" id="reviewCommentCount">0 / 500</span>
        </label>
        <textarea
          id="reviewComment"
          class="review-textarea"
          placeholder="Share your experience: was the room as described? How was the landlord? Any tips for future tenants?"
          maxlength="500"
        ></textarea>
        <span class="review-field-error" id="commentError"></span>
      </div>

      <!-- Submit -->
      <div class="review-submit-row">
        <button class="btn-review-submit" id="reviewSubmitBtn" type="button">
          <svg class="review-spinner" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"
              stroke-dasharray="31.416" stroke-dashoffset="10" stroke-linecap="round"/>
          </svg>
          <span class="review-btn-text">Submit Review</span>
        </button>
      </div>
    </div>`;
}


// ─────────────────────────────────────────────────────────
//  BUILD A SINGLE REVIEW CARD
// ─────────────────────────────────────────────────────────
function buildReviewCard(review, currentUser) {
  const name       = review.reviewer?.name || "Anonymous";
  const initial    = name.charAt(0).toUpperCase();
  const reviewerId = review.reviewer?._id || review.reviewer;
  const userId     = currentUser?._id || currentUser?.id;

  // Only show the delete button if this review belongs to the current user
  const isOwner = currentUser && reviewerId === userId;

  return `
    <div class="review-card" data-review-id="${review._id}">

      <!-- Header: avatar + name + stars + date -->
      <div class="review-card-header">
        <div class="reviewer-avatar" aria-hidden="true">${initial}</div>
        <div class="reviewer-meta">
          <div class="reviewer-name">${escReview(name)}</div>
          <div class="reviewer-stars-date">
            <!-- Small stars row -->
            <div class="stars-small" aria-label="${review.rating} out of 5 stars">
              ${buildStarsSVG(review.rating, "star-small")}
            </div>
            <span class="review-date">${formatDate(review.createdAt)}</span>
          </div>
        </div>
      </div>

      <!-- Comment text -->
      <p class="review-comment">${escReview(review.comment)}</p>

      <!-- Delete button (only shown to review owner on hover) -->
      ${isOwner
        ? `<button
             class="btn-review-delete"
             onclick="deleteReview('${review._id}')"
             aria-label="Delete your review"
           >🗑 Delete</button>`
        : ""}
    </div>`;
}


// ─────────────────────────────────────────────────────────
//  BUILD EMPTY STATE
// ─────────────────────────────────────────────────────────
function buildEmptyState(token) {
  return `
    <div class="reviews-empty">
      <div class="reviews-empty-icon">💬</div>
      <p>
        No reviews yet for this listing.<br/>
        ${token
          ? "Be the first to share your experience!"
          : "Sign in to leave the first review."}
      </p>
    </div>`;
}


// ─────────────────────────────────────────────────────────
//  BUILD LOADING SKELETON
//  Shown while the API request is in progress.
// ─────────────────────────────────────────────────────────
function buildLoadingSkeleton() {
  const skel = () => `
    <div class="review-skeleton">
      <div class="skel-row">
        <div class="skel-circle skeleton"></div>
        <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
          <div class="skeleton" style="height:12px; width:40%;"></div>
          <div class="skeleton" style="height:10px; width:60%;"></div>
        </div>
      </div>
      <div class="skeleton" style="height:12px; width:100%; margin-top:6px;"></div>
      <div class="skeleton" style="height:12px; width:80%;"></div>
    </div>`;

  return `
    <div class="reviews-section">
      <div class="reviews-heading">
        <h3>Reviews</h3>
      </div>
      <div class="skeleton rating-summary-skeleton"></div>
      <div class="reviews-list">${skel()}${skel()}</div>
    </div>`;
}


// ─────────────────────────────────────────────────────────
//  INIT STAR PICKER (interactive hover + click)
//  ─────────────────────────────────────────────────────────
//  After the review form HTML is injected into the DOM,
//  this function attaches event listeners to the star buttons.
//
//  Behaviour:
//  - Hover over star N → all stars 1…N turn amber (preview)
//  - Move mouse away  → revert to the selected rating (or empty)
//  - Click star N     → lock in rating N, update hidden input
// ─────────────────────────────────────────────────────────
function initStarPicker() {
  const picker = document.getElementById("starPicker");
  if (!picker) return; // form not rendered (e.g. not logged in)

  const buttons = picker.querySelectorAll(".star-btn");
  const hintEl  = document.getElementById("starHint");
  const hiddenInput = document.getElementById("selectedRating");

  // Labels for the hint text
  const labels = { 1:"Poor", 2:"Fair", 3:"Good", 4:"Very Good", 5:"Excellent" };

  // Track the currently SELECTED rating (0 = nothing selected yet)
  let selectedRating = 0;

  // ── Helper: visually fill stars up to `n` ──────────────
  function fillStars(n) {
    buttons.forEach((btn, idx) => {
      const svg = btn.querySelector("svg");
      if (idx < n) {
        svg.classList.remove("star-empty");
        svg.classList.add("star-full");
      } else {
        svg.classList.remove("star-full");
        svg.classList.add("star-empty");
      }
    });
  }

  // ── Hover: preview ─────────────────────────────────────
  buttons.forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      const val = Number(btn.dataset.value);
      picker.classList.add("hovering");

      // Mark buttons as in-range for CSS
      buttons.forEach((b, i) => {
        b.classList.toggle("in-range", i < val);
      });

      fillStars(val);
      if (hintEl) hintEl.textContent = `${val} – ${labels[val]}`;
    });
  });

  // ── Mouse leaves the whole picker: revert to selection ─
  picker.addEventListener("mouseleave", () => {
    picker.classList.remove("hovering");
    buttons.forEach(b => b.classList.remove("in-range"));
    fillStars(selectedRating);

    if (hintEl) {
      hintEl.textContent = selectedRating > 0
        ? `${selectedRating} – ${labels[selectedRating]}`
        : "Click a star to rate";
    }
  });

  // ── Click: lock in selection ────────────────────────────
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const val    = Number(btn.dataset.value);
      selectedRating = val;

      // Save value in the hidden input so submitReview() can read it
      if (hiddenInput) hiddenInput.value = val;

      // Update visual state
      fillStars(val);
      buttons.forEach((b, i) => b.classList.toggle("selected", i < val));

      if (hintEl) hintEl.textContent = `${val} – ${labels[val]}`;

      // Clear any star error styling
      const group = document.getElementById("starPickerGroup");
      if (group) group.classList.remove("has-error");
    });
  });
}


// ─────────────────────────────────────────────────────────
//  INIT REVIEW FORM (submit + textarea counter)
// ─────────────────────────────────────────────────────────
function initReviewForm(listingId) {
  const submitBtn = document.getElementById("reviewSubmitBtn");
  const textarea  = document.getElementById("reviewComment");
  const countEl   = document.getElementById("reviewCommentCount");

  if (!submitBtn || !textarea) return;

  // Character counter
  textarea.addEventListener("input", () => {
    const len = textarea.value.length;
    if (countEl) countEl.textContent = `${len} / 500`;
    // Remove error styling once user starts typing
    textarea.classList.remove("invalid");
    const errEl = document.getElementById("commentError");
    if (errEl) errEl.classList.remove("visible");
  });

  // Submit click
  submitBtn.addEventListener("click", () => submitReview(listingId));
}


// ─────────────────────────────────────────────────────────
//  SUBMIT REVIEW
//  Validates inputs, sends POST to /api/reviews/:listingId,
//  and re-renders the reviews section on success.
// ─────────────────────────────────────────────────────────
async function submitReview(listingId) {
  const token  = getAuthToken();
  if (!token) {
    window.location.href = "./login.html";
    return;
  }

  // ── Read values ──────────────────────────────────────
  const ratingInput = document.getElementById("selectedRating");
  const commentEl   = document.getElementById("reviewComment");
  const submitBtn   = document.getElementById("reviewSubmitBtn");

  const rating  = Number(ratingInput?.value);
  const comment = commentEl?.value.trim() || "";

  // ── Validate ─────────────────────────────────────────
  let isValid = true;

  // Star rating validation
  if (!rating || rating < 1 || rating > 5) {
    const group = document.getElementById("starPickerGroup");
    if (group) group.classList.add("has-error");
    isValid = false;
  }

  // Comment validation
  if (comment.length < 10) {
    const errEl = document.getElementById("commentError");
    if (commentEl) commentEl.classList.add("invalid");
    if (errEl) {
      errEl.textContent = comment.length === 0
        ? "Please write a comment (min 10 characters)"
        : `Comment too short — ${comment.length}/10 characters minimum`;
      errEl.classList.add("visible");
    }
    isValid = false;
  }

  if (!isValid) return;

  // ── Show loading state ────────────────────────────────
  if (submitBtn) {
    submitBtn.classList.add("loading");
    submitBtn.disabled = true;
  }

  try {
    // ── POST to API ───────────────────────────────────────
    // Sending as JSON (no file upload here)
    const response = await fetch(`${REVIEWS_API}/${listingId}`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ rating, comment }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // ── Success: reload the reviews section ──────────
      showReviewToast("Review submitted successfully! ⭐", "success");

      // Reload reviews for this listing so the new one appears
      await loadReviews(listingId);

    } else {
      // API returned a specific error (e.g. duplicate review, validation fail)
      showReviewToast(data.message || "Could not submit review.", "error");

      // Re-enable button if it failed
      if (submitBtn) {
        submitBtn.classList.remove("loading");
        submitBtn.disabled = false;
      }
    }

  } catch (error) {
    console.error("Submit review error:", error);
    showReviewToast("Network error. Is the server running?", "error");

    if (submitBtn) {
      submitBtn.classList.remove("loading");
      submitBtn.disabled = false;
    }
  }
}


// ─────────────────────────────────────────────────────────
//  DELETE REVIEW
//  Sends DELETE to /api/reviews/:reviewId,
//  then removes the card from the DOM.
// ─────────────────────────────────────────────────────────
async function deleteReview(reviewId) {
  const token = getAuthToken();
  if (!token) return;

  if (!window.confirm("Delete your review? This cannot be undone.")) return;

  try {
    const response = await fetch(`${REVIEWS_API}/${reviewId}`, {
      method:  "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // Remove the card from the DOM smoothly
      const card = document.querySelector(`[data-review-id="${reviewId}"]`);
      if (card) {
        card.style.transition = "opacity 0.3s, transform 0.3s";
        card.style.opacity    = "0";
        card.style.transform  = "translateX(20px)";
        setTimeout(() => card.remove(), 300);
      }

      showReviewToast("Review deleted.", "success");

      // We reload so the average rating updates correctly
      // Small delay lets the animation finish first
      setTimeout(() => {
        const listingId = document.getElementById("reviewsSection")
          ?.closest("[data-listing-id]")
          ?.dataset.listingId;

        if (listingId) loadReviews(listingId);
      }, 400);

    } else {
      showReviewToast(data.message || "Could not delete review.", "error");
    }

  } catch (error) {
    console.error("Delete review error:", error);
    showReviewToast("Network error.", "error");
  }
}


// ─────────────────────────────────────────────────────────
//  TOAST NOTIFICATION (local to reviews — won't clash
//  with listings.js's showToast)
// ─────────────────────────────────────────────────────────
function showReviewToast(message, type = "info") {
  // Reuse the existing #toastContainer from listings.html
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const icons = { success: "✅", error: "❌", info: "ℹ️" };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ""}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity    = "0";
    toast.style.transition = "opacity 0.4s";
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}


// ─────────────────────────────────────────────────────────
//  LOAD CARD RATINGS
//  ─────────────────────────────────────────────────────────
//  After the listings grid is rendered, fetch average ratings
//  for visible listings and show them on the cards.
//
//  We batch-fetch in parallel (Promise.all) so we don't
//  send 20 sequential API calls for 20 cards.
//
//  @param {Array} listings — the filtered listings array
// ─────────────────────────────────────────────────────────
async function loadCardRatings(listings) {
  if (!listings || listings.length === 0) return;

  // Fetch ratings for all listings in parallel
  await Promise.all(listings.map(async (listing) => {
    try {
      const res  = await fetch(`${REVIEWS_API}/${listing._id}`);
      const data = await res.json();

      if (!res.ok || !data.success) return;

      const stats = data.data?.stats;
      if (!stats || stats.totalReviews === 0) return;

      // Find the badge element for this card
      const badge = document.getElementById(`card-rating-${listing._id}`);
      if (!badge) return;

      const avg   = stats.averageRating;
      const total = stats.totalReviews;

      // Build tiny star row
      const starHTML = [1,2,3,4,5].map(i => `
        <svg viewBox="0 0 24 24" fill="${i <= Math.round(avg) ? '#F5A623' : '#CBD5E1'}"
             stroke="${i <= Math.round(avg) ? '#F5A623' : '#CBD5E1'}" stroke-width="1">
          <path d="${STAR_PATH}"/>
        </svg>`).join("");

      badge.querySelector(".card-rating-stars").innerHTML = starHTML;
      badge.querySelector(".card-rating-num").textContent  = avg.toFixed(1);
      badge.querySelector(".card-rating-count").textContent = `(${total})`;
      badge.style.display = "flex";

    } catch {
      // Silently ignore — ratings are bonus info, not critical
    }
  }));
}
