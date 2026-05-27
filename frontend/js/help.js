// frontend/js/help.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Help & Support Page Script  (NEW v5.0)
//
//  What this file does:
//  ─────────────────────
//  1. Defines all FAQ questions and answers (FAQ_DATA)
//  2. Renders FAQ items as an interactive accordion
//  3. Handles category tab filtering
//  4. Handles real-time search (filters as user types)
//  5. Pre-fills form with logged-in user's name + email
//  6. Validates the contact form
//  7. Submits the form to POST /api/support
//  8. Shows success / error states
// ═══════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────
const API_BASE = "http://localhost:5000/api";


// ─────────────────────────────────────────────────────────
//  FAQ DATA
//  ─────────────────────────────────────────────────────────
//  Each FAQ item has:
//    q        → the question text
//    a        → the answer text (can contain simple HTML)
//    category → must match one of the tab data-cat values
//    dot      → CSS colour for the category dot indicator
// ─────────────────────────────────────────────────────────
const FAQ_DATA = [

  // ── ACCOUNT & LOGIN ────────────────────────────────────
  {
    q:        "How do I reset my password?",
    a:        "Go to the <strong>Login page</strong> and click \"Forgot Password\". Enter the email address you used to sign up and we'll send you a password reset link. Check your spam folder if you don't see it within 5 minutes.",
    category: "account",
    dot:      "#3B82F6",
  },
  {
    q:        "Can I change the email address on my account?",
    a:        "Yes. Go to <strong>Profile → Settings</strong> and update your email. You'll receive a verification email at the new address. Until you verify it, your old email remains active.",
    category: "account",
    dot:      "#3B82F6",
  },
  {
    q:        "How do I delete my FindMate account?",
    a:        "We're sorry to see you go! You can delete your account from <strong>Profile → Settings → Delete Account</strong>. This will permanently remove all your listings, matches, and chat history. This action cannot be undone.",
    category: "account",
    dot:      "#3B82F6",
  },
  {
    q:        "I can't log in — what should I do?",
    a:        "First, check that Caps Lock is off and try again. If you've forgotten your password, use the <strong>Forgot Password</strong> link. If you signed up with Google, try the \"Continue with Google\" button instead. Still stuck? Contact our support team using the form on this page.",
    category: "account",
    dot:      "#3B82F6",
  },

  // ── ROOM LISTINGS ──────────────────────────────────────
  {
    q:        "How do I post a room listing?",
    a:        "Click <strong>+ Post Room</strong> in the navigation bar (you must be logged in). Fill in the listing form — title, description, location, rent, room type, and optional photo. Click \"Post Listing\" and your room will be live immediately.",
    category: "listing",
    dot:      "#13C4A3",
  },
  {
    q:        "How many listings can I post?",
    a:        "You can post up to <strong>5 active listings</strong> at a time on a free account. If you need to post more, contact support. Each listing must be a genuine room you have available.",
    category: "listing",
    dot:      "#13C4A3",
  },
  {
    q:        "How do I edit or delete my listing?",
    a:        "Open the <strong>Browse page</strong>, find your listing, and click the <strong>✏️ Edit</strong> or <strong>🗑 Delete</strong> button that appears on your own cards. You can also manage your listings from your Profile page.",
    category: "listing",
    dot:      "#13C4A3",
  },
  {
    q:        "Can I upload photos of my room?",
    a:        "Yes! You can upload one photo per listing (JPG, PNG, or WebP, max 5MB). Listings with photos receive significantly more enquiries. You can replace the photo anytime by editing the listing.",
    category: "listing",
    dot:      "#13C4A3",
  },
  {
    q:        "Why does my listing not appear in search results?",
    a:        "Listings are searchable immediately after posting. If you can't find yours, check that the city name is spelled correctly. Also check the <strong>isAvailable</strong> status — if it was marked as unavailable, it won't appear in results.",
    category: "listing",
    dot:      "#13C4A3",
  },

  // ── ROOMMATE MATCHING ──────────────────────────────────
  {
    q:        "How does the roommate matching algorithm work?",
    a:        "Our algorithm compares your profile preferences (city, budget, gender preference, lifestyle — smoking, food habits, occupation) with other users and listings. The more complete your profile, the more accurate your matches will be. Visit <strong>My Matches ✨</strong> to see your top matches.",
    category: "roommate",
    dot:      "#F5A623",
  },
  {
    q:        "How do I improve my match quality?",
    a:        "Complete your profile fully under <strong>Profile → Edit Profile</strong>. Set your city, budget range, gender preference, and lifestyle preferences. A complete profile gets up to 3× more relevant matches than an incomplete one.",
    category: "roommate",
    dot:      "#F5A623",
  },
  {
    q:        "Can I filter matches by city or budget?",
    a:        "Yes. On the <strong>My Matches</strong> page, use the filter bar to narrow results by city, max budget, room type, and gender preference. Your filters are saved for the session.",
    category: "roommate",
    dot:      "#F5A623",
  },

  // ── CHAT & MESSAGING ───────────────────────────────────
  {
    q:        "How do I start a conversation with a listing owner?",
    a:        "Open any listing and click the contact number shown on the card to call or WhatsApp them directly. For in-app messaging, go to the <strong>Chat 💬</strong> page and select a user to start a conversation.",
    category: "chat",
    dot:      "#8B5CF6",
  },
  {
    q:        "Are my messages private?",
    a:        "Yes. Messages are private between you and the other person. FindMate does not read your conversations. However, messages reported for abuse may be reviewed by our safety team.",
    category: "chat",
    dot:      "#8B5CF6",
  },
  {
    q:        "I'm not receiving message notifications — what's wrong?",
    a:        "Make sure your browser allows notifications from our site. Check <strong>Browser Settings → Notifications</strong> and ensure FindMate is allowed. Also check that you're not in Do Not Disturb mode.",
    category: "chat",
    dot:      "#8B5CF6",
  },

  // ── SAFETY & PRIVACY ───────────────────────────────────
  {
    q:        "How do I report a suspicious listing or user?",
    a:        "If a listing or user seems suspicious (fake photos, requests money upfront, unverified details), use the <strong>Contact Support</strong> form on this page and select <strong>Safety & Privacy</strong> as the category. Include the listing URL or username. We take all safety reports seriously.",
    category: "safety",
    dot:      "#EF4444",
  },
  {
    q:        "How does FindMate protect my personal data?",
    a:        "Your password is hashed using bcrypt and never stored in plain text. Your email is only shared with users you explicitly contact. You can delete your account and all associated data at any time from your Profile settings.",
    category: "safety",
    dot:      "#EF4444",
  },
  {
    q:        "What are the signs of a rental scam?",
    a:        "🚩 Watch out for: requests to pay a deposit before viewing the property, prices that seem too good to be true, landlords who claim to be abroad and can't show the property, pressure to transfer money via UPI/wire transfer immediately. Always view the property in person before paying.",
    category: "safety",
    dot:      "#EF4444",
  },

  // ── TECHNICAL ──────────────────────────────────────────
  {
    q:        "The page is not loading or showing an error — what do I do?",
    a:        "First, try a <strong>hard refresh</strong> (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac). Clear your browser cache if the issue persists. Make sure the backend server is running on port 5000. If you see a network error, check that MongoDB is connected.",
    category: "technical",
    dot:      "#22C55E",
  },
  {
    q:        "Why is my photo upload failing?",
    a:        "Photo uploads must be <strong>JPG, PNG, or WebP</strong> format and under <strong>5MB</strong>. GIF is also accepted but animations won't display. If your file is too large, use a free tool like <a href='https://squoosh.app' target='_blank' rel='noopener'>Squoosh.app</a> to compress it before uploading.",
    category: "technical",
    dot:      "#22C55E",
  },
  {
    q:        "I'm getting a \"401 Unauthorized\" error — what does that mean?",
    a:        "This means your login session has expired. Simply <strong>sign out and sign back in</strong> to get a fresh token. This usually happens if you've been inactive for a long time or if you cleared your browser's local storage.",
    category: "technical",
    dot:      "#22C55E",
  },
  {
    q:        "The chat / real-time features aren't working. Help!",
    a:        "Real-time chat requires a WebSocket connection via Socket.IO. Make sure the backend server is running and that no firewall or browser extension is blocking WebSocket connections. Try disabling ad blockers temporarily to test.",
    category: "technical",
    dot:      "#22C55E",
  },
];


// ─────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────
let activeCategory = "all";  // currently selected tab
let searchQuery    = "";      // current search input value


// ─────────────────────────────────────────────────────────
//  RENDER FAQ ITEMS INTO #faqList
//  ─────────────────────────────────────────────────────────
//  Filters FAQ_DATA by category and search query,
//  then builds accordion HTML and injects it into the DOM.
// ─────────────────────────────────────────────────────────
function renderFAQ() {
  const container = document.getElementById("faqList");
  if (!container) return;

  // ── Filter by category ──────────────────────────────
  let items = FAQ_DATA;
  if (activeCategory !== "all") {
    items = items.filter(item => item.category === activeCategory);
  }

  // ── Filter by search query ──────────────────────────
  // Case-insensitive search across both question and answer text
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    items = items.filter(
      item =>
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q)
    );
  }

  // ── Render or show empty state ──────────────────────
  if (items.length === 0) {
    container.innerHTML = `
      <div class="faq-no-results">
        <div class="faq-empty-icon">🔍</div>
        <p>
          No results found for "<strong>${escHtml(searchQuery || activeCategory)}</strong>".<br/>
          Try a different keyword or
          <button onclick="filterFAQ('all')" style="color:var(--teal-dark);font-weight:700;background:none;border:none;cursor:pointer;font-size:inherit;">view all questions</button>.
        </p>
      </div>`;
    return;
  }

  // ── Build accordion HTML ────────────────────────────
  container.innerHTML = items.map((item, idx) => `
    <div
      class="faq-item"
      data-idx="${idx}"
      data-cat="${item.category}"
      role="listitem"
    >
      <!-- Clickable question row -->
      <div class="faq-question" onclick="toggleFAQ(this.parentElement)" role="button" tabindex="0"
           aria-expanded="false" aria-controls="faq-answer-${idx}">
        <!-- Coloured dot indicating category -->
        <span class="faq-dot" style="background:${item.dot};" aria-hidden="true"></span>

        <!-- The question text -->
        <span class="faq-q-text">${highlightMatch(escHtml(item.q), searchQuery)}</span>

        <!-- Chevron arrow that rotates on open -->
        <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      <!-- Collapsible answer -->
      <div class="faq-answer" id="faq-answer-${idx}" role="region">
        <p>${item.a}</p>

        <!-- "Was this helpful?" micro-feedback -->
        <div class="faq-helpful">
          <span>Was this helpful?</span>
          <button class="faq-helpful-btn" onclick="markHelpful(this, true)">👍 Yes</button>
          <button class="faq-helpful-btn" onclick="markHelpful(this, false)">👎 No</button>
        </div>
      </div>
    </div>
  `).join("");

  // Allow keyboard navigation (Enter/Space to toggle)
  container.querySelectorAll(".faq-question").forEach(el => {
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleFAQ(el.parentElement);
      }
    });
  });
}


// ─────────────────────────────────────────────────────────
//  TOGGLE FAQ ITEM OPEN/CLOSED
// ─────────────────────────────────────────────────────────
function toggleFAQ(item) {
  const isOpen     = item.classList.contains("open");
  const questionEl = item.querySelector(".faq-question");

  // Close all open items first (accordion behaviour)
  document.querySelectorAll(".faq-item.open").forEach(openItem => {
    openItem.classList.remove("open");
    const q = openItem.querySelector(".faq-question");
    if (q) q.setAttribute("aria-expanded", "false");
  });

  // If this item was closed, open it; if it was open, leave it closed
  if (!isOpen) {
    item.classList.add("open");
    if (questionEl) questionEl.setAttribute("aria-expanded", "true");
  }
}


// ─────────────────────────────────────────────────────────
//  FILTER BY CATEGORY
//  Called when a tab or a quick-card is clicked.
// ─────────────────────────────────────────────────────────
function filterFAQ(category) {
  activeCategory = category;
  searchQuery    = "";

  // Update tab visual state
  document.querySelectorAll(".faq-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.cat === category);
  });

  // Clear search input
  const searchEl = document.getElementById("faqSearch");
  if (searchEl) searchEl.value = "";

  renderFAQ();

  // Smooth scroll to FAQ section on mobile
  const section = document.getElementById("faq-section");
  if (section && window.innerWidth < 768) {
    setTimeout(() => section.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }
}


// ─────────────────────────────────────────────────────────
//  REAL-TIME SEARCH
//  Filters as the user types in the hero search box.
// ─────────────────────────────────────────────────────────
function searchFAQ() {
  const input = document.getElementById("faqSearch");
  if (!input) return;
  searchQuery    = input.value;
  activeCategory = "all";

  // Reset all tabs to inactive
  document.querySelectorAll(".faq-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.cat === "all");
  });

  renderFAQ();
}


// Attach live search to the input (fires on every keystroke)
document.addEventListener("DOMContentLoaded", () => {
  const searchEl = document.getElementById("faqSearch");
  if (searchEl) {
    searchEl.addEventListener("input", searchFAQ);
    searchEl.addEventListener("keydown", e => {
      if (e.key === "Enter") searchFAQ();
    });
  }
});


// ─────────────────────────────────────────────────────────
//  HIGHLIGHT MATCHED TEXT
//  Wraps the search term in a <mark> tag for visual emphasis.
//  Example: highlightMatch("Reset password", "pass")
//           → "Reset <mark>pass</mark>word"
// ─────────────────────────────────────────────────────────
function highlightMatch(text, query) {
  if (!query || !query.trim()) return text;
  const regex = new RegExp(`(${escapeRegex(query.trim())})`, "gi");
  return text.replace(regex, '<mark style="background:#FEF08A;border-radius:3px;padding:0 2px;">$1</mark>');
}

// Escape special regex characters in the search query
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


// ─────────────────────────────────────────────────────────
//  "WAS THIS HELPFUL?" MICRO-FEEDBACK
//  Marks the clicked button as voted; disables both buttons.
// ─────────────────────────────────────────────────────────
function markHelpful(btn, wasHelpful) {
  // Find both buttons in this helpful row
  const row = btn.closest(".faq-helpful");
  if (!row) return;

  const allBtns = row.querySelectorAll(".faq-helpful-btn");

  // Mark the clicked one as selected
  allBtns.forEach(b => {
    b.disabled = true;
    b.style.opacity = "0.5";
  });

  btn.classList.add("voted");
  btn.style.opacity = "1";
  btn.textContent   = wasHelpful ? "✅ Thanks!" : "❌ Got it";

  // Replace the helper text
  const label = row.querySelector("span");
  if (label) label.textContent = "Thanks for your feedback!";
}


// ─────────────────────────────────────────────────────────
//  ESCAPE HTML (prevent XSS in user input shown in the UI)
// ─────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ─────────────────────────────────────────────────────────
//  PRE-FILL FORM FROM LOCAL STORAGE
//  If the user is already logged in, fill their name + email.
// ─────────────────────────────────────────────────────────
function prefillForm() {
  try {
    const raw  = localStorage.getItem("findmate_user");
    const user = raw ? JSON.parse(raw) : null;

    if (user) {
      const nameEl  = document.getElementById("name");
      const emailEl = document.getElementById("email");
      if (nameEl  && user.name)  nameEl.value  = user.name;
      if (emailEl && user.email) emailEl.value = user.email;
    }
  } catch {
    // localStorage not available or corrupted — ignore
  }
}


// ─────────────────────────────────────────────────────────
//  FORM VALIDATION HELPERS
// ─────────────────────────────────────────────────────────
function setFieldError(fieldId, show) {
  const field = document.getElementById(fieldId);
  const err   = document.getElementById(`err-${fieldId}`);
  const group = document.getElementById(`fg-${fieldId}`);

  if (show) {
    if (field) field.classList.add("invalid");
    if (err)   err.classList.add("show");
  } else {
    if (field) field.classList.remove("invalid");
    if (err)   err.classList.remove("show");
  }
}

function clearFieldError(fieldId) {
  setFieldError(fieldId, false);
}

// Clear errors when user starts correcting a field
["name","email","category","message"].forEach(id => {
  document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input",  () => clearFieldError(id));
      el.addEventListener("change", () => clearFieldError(id));
    }
  });
});

function validateForm() {
  let valid = true;

  const name     = document.getElementById("name")?.value.trim()     || "";
  const email    = document.getElementById("email")?.value.trim()    || "";
  const category = document.getElementById("category")?.value        || "";
  const message  = document.getElementById("message")?.value.trim()  || "";

  // Name: required, min 2 chars
  if (name.length < 2) {
    setFieldError("name", true);
    valid = false;
  }

  // Email: required, basic format
  const emailOk = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(email);
  if (!emailOk) {
    setFieldError("email", true);
    valid = false;
  }

  // Category: required
  if (!category) {
    setFieldError("category", true);
    valid = false;
  }

  // Message: required, min 20 chars
  if (message.length < 20) {
    setFieldError("message", true);
    valid = false;
  }

  return valid;
}


// ─────────────────────────────────────────────────────────
//  CHARACTER COUNTER FOR MESSAGE TEXTAREA
// ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.getElementById("message");
  const counter  = document.getElementById("charCounter");

  if (textarea && counter) {
    textarea.addEventListener("input", () => {
      const len = textarea.value.length;
      counter.textContent = `${len} / 2000`;

      counter.classList.remove("warn", "over");
      if (len > 1800) counter.classList.add("warn");
      if (len >= 2000) counter.classList.add("over");
    });
  }
});


// ─────────────────────────────────────────────────────────
//  SHOW / HIDE ALERT BANNER
// ─────────────────────────────────────────────────────────
function showFormAlert(message, type = "error") {
  const alertEl = document.getElementById("formAlert");
  const msgEl   = document.getElementById("formAlertMsg");
  if (!alertEl || !msgEl) return;

  alertEl.className = `form-alert ${type} show`;
  msgEl.textContent  = message;

  // Auto-hide after 8 seconds
  setTimeout(() => {
    alertEl.classList.remove("show");
  }, 8000);
}

function hideFormAlert() {
  const alertEl = document.getElementById("formAlert");
  if (alertEl) alertEl.classList.remove("show");
}


// ─────────────────────────────────────────────────────────
//  SUBMIT SUPPORT FORM
//  Sends a POST request to /api/support and handles response.
// ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const form      = document.getElementById("supportForm");
  const submitBtn = document.getElementById("submitBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();  // stop browser from reloading the page
    hideFormAlert();

    // ── Validate ────────────────────────────────────────
    if (!validateForm()) {
      // Scroll to first error so the user can see it
      const firstError = form.querySelector(".form-input.invalid, .form-select.invalid, .form-textarea.invalid");
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // ── Show loading state ───────────────────────────────
    submitBtn.classList.add("loading");
    submitBtn.disabled = true;

    // ── Collect form data ────────────────────────────────
    const payload = {
      name:     document.getElementById("name").value.trim(),
      email:    document.getElementById("email").value.trim(),
      category: document.getElementById("category").value,
      message:  document.getElementById("message").value.trim(),
    };

    try {
      // ── Send to API ──────────────────────────────────────
      // If the user is logged in, include their JWT token
      // so the backend can link the ticket to their account.
      const token   = localStorage.getItem("findmate_token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/support`, {
        method:  "POST",
        headers,
        body:    JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // ── Show success panel ─────────────────────────────
        showSuccessState(data.data?.ticketId);

      } else {
        // API returned a validation or server error
        showFormAlert(data.message || "Failed to send your request. Please try again.");
      }

    } catch (error) {
      console.error("Support form error:", error);
      showFormAlert("Could not connect to the server. Please check your internet connection.");

    } finally {
      // Re-enable the button regardless of outcome
      submitBtn.classList.remove("loading");
      submitBtn.disabled = false;
    }
  });
});


// ─────────────────────────────────────────────────────────
//  SUCCESS STATE — hides the form, shows confirmation panel
// ─────────────────────────────────────────────────────────
function showSuccessState(ticketId) {
  const formBody     = document.getElementById("formBody");
  const successState = document.getElementById("successState");
  const ticketDisplay = document.getElementById("ticketIdDisplay");

  if (formBody)     formBody.style.display     = "none";
  if (successState) successState.classList.add("show");

  // Show a short version of the ticket ID (last 8 chars)
  if (ticketDisplay && ticketId) {
    ticketDisplay.textContent = String(ticketId).slice(-8).toUpperCase();
  }
}


// ─────────────────────────────────────────────────────────
//  RESET FORM — for "Submit Another Request" button
// ─────────────────────────────────────────────────────────
function resetForm() {
  const form         = document.getElementById("supportForm");
  const formBody     = document.getElementById("formBody");
  const successState = document.getElementById("successState");

  if (form)         form.reset();
  if (formBody)     formBody.style.display     = "";
  if (successState) successState.classList.remove("show");

  // Re-prefill name/email from localStorage
  prefillForm();

  // Reset char counter
  const counter = document.getElementById("charCounter");
  if (counter) {
    counter.textContent = "0 / 2000";
    counter.className   = "char-counter";
  }

  // Clear any field errors
  ["name","email","category","message"].forEach(clearFieldError);
  hideFormAlert();
}


// ─────────────────────────────────────────────────────────
//  INIT — runs when the DOM is fully loaded
// ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // 1. Render all FAQ items (default: show all categories)
  renderFAQ();

  // 2. Pre-fill name + email if user is logged in
  prefillForm();
});
