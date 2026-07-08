// register.js
// ============================================================
//  FindMate – Registration Page Logic
//
//  What this file does (in order):
//  1. Gets references to all HTML elements we need
//  2. Adds real-time validation on each field (as user types)
//  3. Shows password strength meter as user types password
//  4. Toggles password visibility (show/hide)
//  5. On form submit → validates all fields → calls backend API
//  6. Handles API success → saves token → redirects to home
//  7. Handles API errors → shows friendly error message
// ============================================================


// ─────────────────────────────────────────────────────────────
// SECTION 1: CONFIGURATION
// ─────────────────────────────────────────────────────────────

// The backend API base URL — change this if your server runs elsewhere
const API_BASE = window.APP_CONFIG.API_BASE + "/api/auth/register";


// ─────────────────────────────────────────────────────────────
// SECTION 2: GET REFERENCES TO HTML ELEMENTS
//
// We grab every element we'll need and store it in a variable.
// This is more efficient than calling document.getElementById
// multiple times throughout the code.
// ─────────────────────────────────────────────────────────────

const form            = document.getElementById("registerForm");

// Input fields
const inputName       = document.getElementById("fullName");
const inputEmail      = document.getElementById("email");
const inputPassword   = document.getElementById("password");
const inputConfirm    = document.getElementById("confirmPassword");
const checkTerms      = document.getElementById("agreeTerms");

// Field wrapper divs (we add/remove CSS classes on these)
const groupName       = document.getElementById("group-name");
const groupEmail      = document.getElementById("group-email");
const groupPassword   = document.getElementById("group-password");
const groupConfirm    = document.getElementById("group-confirm");

// Error message spans below each field
const errorName       = document.getElementById("error-name");
const errorEmail      = document.getElementById("error-email");
const errorPassword   = document.getElementById("error-password");
const errorConfirm    = document.getElementById("error-confirm");
const errorTerms      = document.getElementById("error-terms");

// Password strength elements
const strengthWrapper = document.getElementById("strengthWrapper");
const strengthFill    = document.getElementById("strengthFill");
const strengthLabel   = document.getElementById("strengthLabel");

// Submit button elements
const submitBtn       = document.getElementById("submitBtn");

// Alert banner elements
const alertSuccess    = document.getElementById("alertSuccess");
const alertSuccessText= document.getElementById("alertSuccessMsg");   // unified ID
const alertError      = document.getElementById("alertError");
const alertErrorText  = document.getElementById("alertErrorMsg");     // unified ID

// Password toggle buttons
const togglePassword  = document.getElementById("togglePassword");
const toggleConfirm   = document.getElementById("toggleConfirm");


// ─────────────────────────────────────────────────────────────
// SECTION 3: VALIDATION HELPER FUNCTIONS
//
// Each function returns { valid: true/false, message: "..." }
// This makes it easy to reuse them and display the right error.
// ─────────────────────────────────────────────────────────────

/**
 * Validate full name:
 * - Not empty
 * - At least 2 characters
 * - Only letters, spaces, dots, and hyphens
 */
function validateName(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, message: "Full name is required" };
  }
  if (trimmed.length < 2) {
    return { valid: false, message: "Name must be at least 2 characters" };
  }
  if (!/^[a-zA-Z\s.\-']+$/.test(trimmed)) {
    return { valid: false, message: "Name can only contain letters, spaces, and hyphens" };
  }
  return { valid: true, message: "" };
}

/**
 * Validate email:
 * - Not empty
 * - Matches standard email pattern (user@domain.com)
 */
function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, message: "Email address is required" };
  }
  // Standard email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, message: "Please enter a valid email address" };
  }
  return { valid: true, message: "" };
}

/**
 * Validate password:
 * - Not empty
 * - At least 6 characters
 * - Returns strength score 1–4 (used for the strength bar)
 */
function validatePassword(value) {
  if (!value) {
    return { valid: false, message: "Password is required", strength: 0 };
  }
  if (value.length < 6) {
    return { valid: false, message: "Password must be at least 6 characters", strength: 1 };
  }
  return { valid: true, message: "", strength: getPasswordStrength(value) };
}

/**
 * Validate confirm password:
 * - Not empty
 * - Must match the password field
 */
function validateConfirm(value, passwordValue) {
  if (!value) {
    return { valid: false, message: "Please confirm your password" };
  }
  if (value !== passwordValue) {
    return { valid: false, message: "Passwords do not match" };
  }
  return { valid: true, message: "" };
}


// ─────────────────────────────────────────────────────────────
// SECTION 4: PASSWORD STRENGTH CALCULATOR
//
// Checks the password against several criteria and returns
// a score from 1 (weak) to 4 (strong).
// ─────────────────────────────────────────────────────────────

function getPasswordStrength(password) {
  let score = 0;

  if (password.length >= 8)                    score++; // decent length
  if (/[A-Z]/.test(password))                  score++; // has uppercase
  if (/[0-9]/.test(password))                  score++; // has a number
  if (/[^A-Za-z0-9]/.test(password))           score++; // has special char (!@#$ etc.)

  // Minimum score is 1 if password exists
  return Math.max(score, 1);
}

/**
 * Update the strength bar UI based on score
 */
function updateStrengthBar(score) {
  const labels = { 1: "Weak", 2: "Fair", 3: "Good", 4: "Strong" };
  const colors = {
    1: "var(--strength-weak)",
    2: "var(--strength-fair)",
    3: "var(--strength-good)",
    4: "var(--strength-strong)"
  };

  strengthWrapper.classList.add("visible");
  strengthFill.setAttribute("data-strength", score);
  strengthLabel.textContent = labels[score] || "";
  strengthLabel.style.color = colors[score] || "inherit";
}


// ─────────────────────────────────────────────────────────────
// SECTION 5: UI HELPER FUNCTIONS
//
// These functions update the DOM to show valid/error states.
// ─────────────────────────────────────────────────────────────

/**
 * Mark a field as VALID (green border, clears error)
 * @param {HTMLElement} group  - the .field-group div
 * @param {HTMLElement} errorEl - the .field-error span
 */
function setValid(group, errorEl) {
  group.classList.remove("is-error");
  group.classList.add("is-valid");
  errorEl.textContent = "";
}

/**
 * Mark a field as INVALID (red border, shows error message)
 * @param {HTMLElement} group   - the .field-group div
 * @param {HTMLElement} errorEl - the .field-error span
 * @param {string} message      - the error text to display
 */
function setError(group, errorEl, message) {
  group.classList.remove("is-valid");
  group.classList.add("is-error");
  errorEl.textContent = message;
}

/**
 * Clear a field back to neutral state
 */
function clearState(group, errorEl) {
  group.classList.remove("is-valid", "is-error");
  errorEl.textContent = "";
}

/**
 * Show the global success alert banner
 */
function showSuccess(message) {
  alertSuccess.classList.add("show");
  alertError.classList.remove("show");
  alertSuccessText.textContent = message;
}

/**
 * Show the global error alert banner
 */
function showErrorAlert(message) {
  alertError.classList.add("show");
  alertSuccess.classList.remove("show");
  alertErrorText.textContent = message;
}

/**
 * Hide both alert banners
 */
function hideAlerts() {
  alertSuccess.classList.remove("show");
  alertError.classList.remove("show");
}

/**
 * Set the submit button to loading state (spinner + disabled)
 */
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  if (isLoading) {
    submitBtn.classList.add("loading");
  } else {
    submitBtn.classList.remove("loading");
  }
}

/**
 * Trigger shake animation on the submit button (on validation fail)
 */
function shakeButton() {
  submitBtn.classList.add("shake");
  // Remove the class after animation ends so it can be triggered again
  submitBtn.addEventListener("animationend", () => {
    submitBtn.classList.remove("shake");
  }, { once: true }); // { once: true } auto-removes the listener
}


// ─────────────────────────────────────────────────────────────
// SECTION 6: REAL-TIME VALIDATION (as user types)
//
// We listen for "input" events on each field.
// The field turns green ✓ when valid, red ✗ when invalid.
// This gives instant feedback without waiting for form submit.
// ─────────────────────────────────────────────────────────────

inputName.addEventListener("input", () => {
  const result = validateName(inputName.value);
  if (inputName.value.trim() === "") {
    clearState(groupName, errorName);  // don't show error on empty while typing
  } else if (result.valid) {
    setValid(groupName, errorName);
  } else {
    setError(groupName, errorName, result.message);
  }
});

inputEmail.addEventListener("input", () => {
  const result = validateEmail(inputEmail.value);
  if (inputEmail.value.trim() === "") {
    clearState(groupEmail, errorEmail);
  } else if (result.valid) {
    setValid(groupEmail, errorEmail);
  } else {
    setError(groupEmail, errorEmail, result.message);
  }
});

inputPassword.addEventListener("input", () => {
  const value = inputPassword.value;
  const result = validatePassword(value);

  if (value === "") {
    clearState(groupPassword, errorPassword);
    strengthWrapper.classList.remove("visible"); // hide strength bar
    return;
  }

  // Update strength bar
  updateStrengthBar(result.strength);

  if (result.valid) {
    setValid(groupPassword, errorPassword);
  } else {
    setError(groupPassword, errorPassword, result.message);
  }

  // Re-validate confirm field live if it already has content
  if (inputConfirm.value) {
    const confirmResult = validateConfirm(inputConfirm.value, value);
    if (confirmResult.valid) {
      setValid(groupConfirm, errorConfirm);
    } else {
      setError(groupConfirm, errorConfirm, confirmResult.message);
    }
  }
});

inputConfirm.addEventListener("input", () => {
  const result = validateConfirm(inputConfirm.value, inputPassword.value);
  if (inputConfirm.value === "") {
    clearState(groupConfirm, errorConfirm);
  } else if (result.valid) {
    setValid(groupConfirm, errorConfirm);
  } else {
    setError(groupConfirm, errorConfirm, result.message);
  }
});


// ─────────────────────────────────────────────────────────────
// SECTION 7: PASSWORD SHOW / HIDE TOGGLE
// ─────────────────────────────────────────────────────────────

function toggleVisibility(inputEl, toggleBtn) {
  const isHidden = inputEl.type === "password";
  inputEl.type = isHidden ? "text" : "password";

  // Toggle the two SVG children: .eye-open / .eye-closed
  const eyeOpen   = toggleBtn.querySelector(".eye-open");
  const eyeClosed = toggleBtn.querySelector(".eye-closed");
  if (eyeOpen && eyeClosed) {
    eyeOpen.style.display   = isHidden ? "none" : "";
    eyeClosed.style.display = isHidden ? "" : "none";
  }
  toggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
}

togglePassword.addEventListener("click", () => {
  toggleVisibility(inputPassword, togglePassword);
});

toggleConfirm.addEventListener("click", () => {
  toggleVisibility(inputConfirm, toggleConfirm);
});


// ─────────────────────────────────────────────────────────────
// SECTION 8: FORM SUBMISSION
//
// When user clicks "Create Account":
// 1. Validate ALL fields at once
// 2. If any fail → show errors, shake button, stop
// 3. If all pass → call the backend API
// ─────────────────────────────────────────────────────────────

form.addEventListener("submit", async (event) => {
  // Prevent the default browser form submission (page reload)
  event.preventDefault();

  // Hide any previous alert banners
  hideAlerts();

  // ── Step 1: Validate all fields ───────────────────────────
  const nameResult     = validateName(inputName.value);
  const emailResult    = validateEmail(inputEmail.value);
  const passwordResult = validatePassword(inputPassword.value);
  const confirmResult  = validateConfirm(inputConfirm.value, inputPassword.value);
  const termsChecked   = checkTerms.checked;

  // Apply visual state for each field
  nameResult.valid
    ? setValid(groupName, errorName)
    : setError(groupName, errorName, nameResult.message);

  emailResult.valid
    ? setValid(groupEmail, errorEmail)
    : setError(groupEmail, errorEmail, emailResult.message);

  passwordResult.valid
    ? setValid(groupPassword, errorPassword)
    : setError(groupPassword, errorPassword, passwordResult.message);

  confirmResult.valid
    ? setValid(groupConfirm, errorConfirm)
    : setError(groupConfirm, errorConfirm, confirmResult.message);

  // Terms error
  if (!termsChecked) {
    errorTerms.textContent = "You must agree to the Terms of Service";
    errorTerms.style.opacity = "1";
  } else {
    errorTerms.textContent = "";
    errorTerms.style.opacity = "0";
  }

  // ── Step 2: Stop if anything is invalid ───────────────────
  const allValid =
    nameResult.valid &&
    emailResult.valid &&
    passwordResult.valid &&
    confirmResult.valid &&
    termsChecked;

  if (!allValid) {
    shakeButton(); // shake the submit button to draw attention
    return;        // stop here, do not call the API
  }

  // ── Step 3: Call the backend API ──────────────────────────
  await registerUser({
    name: inputName.value.trim(),
    email: inputEmail.value.trim().toLowerCase(),
    password: inputPassword.value,
  });
});


// ─────────────────────────────────────────────────────────────
// SECTION 9: API CALL — registerUser()
//
// This function sends the form data to the backend.
// It uses the Fetch API (built into modern browsers).
//
// Flow:
//   fetch(url, options)
//     → backend processes the request
//     → we read the JSON response
//     → success: save token, redirect
//     → error: show error message
// ─────────────────────────────────────────────────────────────

async function registerUser(userData) {
  // Show loading spinner on button
  setLoading(true);

  try {
    // ── Make the API request ──────────────────────────────
    const response = await fetch(API_BASE_URL, {
      method: "POST",                         // HTTP method

      headers: {
        "Content-Type": "application/json",   // tell server we're sending JSON
      },

      // Convert our JS object to a JSON string for the request body
      body: JSON.stringify(userData),
    });

    // Parse the JSON response from the server
    const data = await response.json();

    // ── Handle success (HTTP 201 Created) ────────────────
    if (response.ok) {
      // The backend returns { success: true, token: "...", data: { user: {...} } }

      // Save the JWT token to localStorage so future requests can use it
      localStorage.setItem("findmate_token", data.token);

      // Optionally save basic user info (useful for showing name in dashboard)
      localStorage.setItem("findmate_user", JSON.stringify(data.data.user));

      // Show success message
      const userName = data.data.user.name.split(" ")[0]; // first name only
      showSuccess(`Welcome to FindMate, ${userName}! 🎉 Redirecting to home page...`);

      // Redirect to dashboard after a short delay (so user sees the message)
      setTimeout(() => {
        window.location.href = "home.html";
      }, 2000); // 2 second delay

    } else {
      // ── Handle API-level errors (4xx, 5xx) ─────────────
      // The backend sends { success: false, message: "..." }
      const errorMessage = data.message || "Registration failed. Please try again.";
      showErrorAlert(errorMessage);
    }

  } catch (networkError) {
    // ── Handle network errors (server is down, no internet) ──
    console.error("Network error:", networkError);
    showErrorAlert(
      "Cannot connect to the server. Please check your internet connection and try again."
    );
  } finally {
    // Always remove loading state, whether it succeeded or failed
    setLoading(false);
  }
}


// ─────────────────────────────────────────────────────────────
// SECTION 10: UTILITY — Check if already logged in
//
// If the user already has a valid token in localStorage,
// redirect them away from the register page automatically.
// ─────────────────────────────────────────────────────────────

(function checkAlreadyLoggedIn() {
  const token = localStorage.getItem("findmate_token");
  if (token) {
    // User is already logged in — send them straight to the dashboard
    window.location.href = "home.html";
  }
})(); // The () at the end runs this function immediately (IIFE pattern)


// ─────────────────────────────────────────────────────────────
// LIVE STATS  (Active Listings · Happy Matches · Cities)
//
// Fetches real counts from GET /api/stats and populates the
// brand panel stat numbers. Mirrors the same logic in login.js.
// ─────────────────────────────────────────────────────────────

const API_STATS_URL = "http://localhost:5000/api/stats";

function formatStat(n) {
  if (n >= 1000) return Math.floor(n / 1000) + "K+";
  return String(n);
}

async function loadLiveStats() {
  const elListings = document.getElementById("stat-listings");
  const elMatches  = document.getElementById("stat-matches");
  const elCities   = document.getElementById("stat-cities");
  if (!elListings || !elMatches || !elCities) return;

  try {
    const res  = await fetch(API_STATS_URL, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    if (json.success && json.data) {
      elListings.textContent = formatStat(json.data.activeListings);
      elMatches.textContent  = formatStat(json.data.happyMatches);
      elCities.textContent   = formatStat(json.data.cities);
    }
  } catch (_) {
    const els = [elListings, elMatches, elCities];
    els.forEach(el => { if (el) el.textContent = "—"; });
  }
}

loadLiveStats();
