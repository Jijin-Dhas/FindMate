// frontend/js/login.js
// ============================================================
//  FindMate – Login Page Logic  (UPDATED: Firebase Google Sign-In)
//
//  What this file does (in order):
//  1. Immediately checks if user is already logged in → redirect to home
//  2. Handles show / hide password toggle
//  3. Real-time field validation (clears errors as you type)
//  4. On submit: validates → calls API → handles response
//  5. On success: saves JWT + user data → redirects to home
//  6. On error: shows friendly error message
//  7. NEW: Google Sign-In via Firebase popup
//       → saves name, email, profileImage to localStorage
//       → redirects to home on success
// ============================================================


// ─────────────────────────────────────────────────────────────
// SECTION 1: FIREBASE IMPORTS
//
// We import from firebase.js (which itself pulls Firebase from CDN).
// This file must be loaded as type="module" in login.html.
// ─────────────────────────────────────────────────────────────

import { auth, provider, signInWithPopup }
  from './firebase.js';


// ─────────────────────────────────────────────────────────────
// SECTION 2: CONFIGURATION
// Only change things here — nowhere else needs updating.
// ─────────────────────────────────────────────────────────────

const API_LOGIN_URL  = 'http://localhost:5000/api/auth/login';
const DASHBOARD_PATH = './home.html';

// These keys must match what register.js and home.html use
const TOKEN_KEY = 'findmate_token';
const USER_KEY  = 'findmate_user';


// ─────────────────────────────────────────────────────────────
// SECTION 3: REDIRECT IF ALREADY LOGGED IN
// Runs the moment this script loads — before the page is shown.
// ─────────────────────────────────────────────────────────────

(function checkExistingSession() {
  if (localStorage.getItem(TOKEN_KEY)) {
    // Already have a token — go straight to dashboard
    window.location.replace(DASHBOARD_PATH);
  }
})();


// ─────────────────────────────────────────────────────────────
// SECTION 4: GET DOM ELEMENTS
// We grab every element once and store it — more efficient
// than calling getElementById inside every event handler.
// ─────────────────────────────────────────────────────────────

const loginForm     = document.getElementById('loginForm');
const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn      = document.getElementById('loginBtn');

const alertSuccess    = document.getElementById('alertSuccess');
const alertError      = document.getElementById('alertError');
const alertSuccessMsg = document.getElementById('alertSuccessMsg');
const alertErrorMsg   = document.getElementById('alertErrorMsg');

const fieldEmail    = document.getElementById('fieldEmail');
const fieldPassword = document.getElementById('fieldPassword');
const emailError    = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');

const togglePasswordBtn = document.getElementById('togglePassword');
const eyeOpen           = togglePasswordBtn.querySelector('.eye-open');
const eyeClosed         = togglePasswordBtn.querySelector('.eye-closed');

// Google Sign-In button (the first .social-btn in the social row)
const googleBtn = document.getElementById('googleSignInBtn');


// ─────────────────────────────────────────────────────────────
// SECTION 5: HELPER FUNCTIONS
// Small, reusable functions used throughout this file.
// ─────────────────────────────────────────────────────────────

/** Show a success or error alert banner. */
function showAlert(type, message) {
  alertSuccess.classList.remove('show');
  alertError.classList.remove('show');

  if (type === 'success') {
    alertSuccessMsg.textContent = message;
    alertSuccess.classList.add('show');
  } else {
    alertErrorMsg.textContent = message;
    alertError.classList.add('show');
  }
}

/** Hide all alert banners. */
function hideAlerts() {
  alertSuccess.classList.remove('show');
  alertError.classList.remove('show');
}

/** Mark a field as invalid with an inline error message. */
function setFieldError(fieldWrapper, errorEl, message) {
  fieldWrapper.classList.add('has-error');
  fieldWrapper.classList.remove('is-valid');
  errorEl.textContent = message;
}

/** Remove the error state from a field. */
function clearFieldError(fieldWrapper, errorEl) {
  fieldWrapper.classList.remove('has-error');
  errorEl.textContent = '';
}

/** Mark a field as valid (green border). */
function setFieldValid(fieldWrapper) {
  fieldWrapper.classList.remove('has-error');
  fieldWrapper.classList.add('is-valid');
}

/** Disable the main login button and show spinner. */
function setButtonLoading() {
  loginBtn.classList.add('loading');
  loginBtn.disabled = true;
}

/** Re-enable the main login button and hide spinner. */
function resetButton() {
  loginBtn.classList.remove('loading');
  loginBtn.disabled = false;
}

/** Returns true if the string looks like a valid email. */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


// ─────────────────────────────────────────────────────────────
// SECTION 6: SHOW / HIDE PASSWORD TOGGLE
// Clicking the eye icon switches between readable and dots.
// ─────────────────────────────────────────────────────────────

togglePasswordBtn.addEventListener('click', function () {
  const isHidden = passwordInput.type === 'password';

  passwordInput.type      = isHidden ? 'text' : 'password';
  eyeOpen.style.display   = isHidden ? 'none' : '';
  eyeClosed.style.display = isHidden ? '' : 'none';
  togglePasswordBtn.setAttribute(
    'aria-label',
    isHidden ? 'Hide password' : 'Show password'
  );
});

togglePasswordBtn.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    togglePasswordBtn.click();
  }
});


// ─────────────────────────────────────────────────────────────
// SECTION 7: REAL-TIME VALIDATION
// Errors clear the moment the user starts re-typing.
// ─────────────────────────────────────────────────────────────

emailInput.addEventListener('input', function () {
  clearFieldError(fieldEmail, emailError);
  hideAlerts();
});

passwordInput.addEventListener('input', function () {
  clearFieldError(fieldPassword, passwordError);
  hideAlerts();
});


// ─────────────────────────────────────────────────────────────
// SECTION 8: FORM VALIDATION
// Checks all fields and shows red errors if something is wrong.
// Returns true only if everything passes.
// ─────────────────────────────────────────────────────────────

function validateForm() {
  let isValid = true;

  const emailValue    = emailInput.value.trim();
  const passwordValue = passwordInput.value; // never trim passwords

  // Validate email
  if (!emailValue) {
    setFieldError(fieldEmail, emailError, 'Please enter your email address.');
    isValid = false;
  } else if (!isValidEmail(emailValue)) {
    setFieldError(fieldEmail, emailError, 'Please enter a valid email (e.g. you@example.com).');
    isValid = false;
  } else {
    setFieldValid(fieldEmail);
  }

  // Validate password
  if (!passwordValue) {
    setFieldError(fieldPassword, passwordError, 'Please enter your password.');
    isValid = false;
  } else if (passwordValue.length < 6) {
    setFieldError(fieldPassword, passwordError, 'Password must be at least 6 characters.');
    isValid = false;
  } else {
    setFieldValid(fieldPassword);
  }

  return isValid;
}


// ─────────────────────────────────────────────────────────────
// SECTION 9: EMAIL / PASSWORD FORM SUBMIT HANDLER
//
// Flow:
//  1. Prevent page reload
//  2. Validate fields — stop if there are errors
//  3. Show loading spinner
//  4. Call POST /api/auth/login with fetch()
//  5a. Success → save token + user → redirect to home
//  5b. Server error → show message from API
//  5c. Network error → tell user server is unreachable
// ─────────────────────────────────────────────────────────────

loginForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  hideAlerts();

  if (!validateForm()) return;

  setButtonLoading();

  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    const response = await fetch(API_LOGIN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      // The FindMate API returns: { success, token, data: { user } }
      const token = data.token || data.accessToken || data.jwt;
      const user  = data.data?.user || data.user || { email };

      if (token) localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      showAlert('success', '✅ Login successful! Taking you to your home page…');

      setTimeout(function () {
        window.location.href = DASHBOARD_PATH;
      }, 1200);

    } else {
      resetButton();
      const serverMessage =
        data.message ||
        data.error   ||
        'Login failed. Please check your credentials and try again.';
      showAlert('error', serverMessage);
    }

  } catch (networkError) {
    resetButton();
    console.error('Network error during login:', networkError);
    showAlert(
      'error',
      '⚠️ Cannot reach the server. Make sure the backend is running on port 5000 and try again.'
    );
  }
});


// ─────────────────────────────────────────────────────────────
// SECTION 10: GOOGLE SIGN-IN HANDLER (Firebase)
//
// Flow:
//  1. User clicks the Google button
//  2. Firebase opens a Google account-chooser popup
//  3. On success: extract name, email, profileImage from Google
//  4. Save all three to localStorage for use across the app
//  5. Save a synthetic "firebase" token so existing auth
//     guards (which check TOKEN_KEY) treat the user as logged in
//  6. Redirect to the home dashboard
//
// Why no backend call?
//  For the initial Google Sign-In we trust Firebase's own
//  ID token. If your backend needs to verify the Google user
//  (recommended for production), send result.user.getIdToken()
//  to a new POST /api/auth/google endpoint and get a real JWT.
// ─────────────────────────────────────────────────────────────

if (googleBtn) {
  googleBtn.addEventListener('click', async function () {
    // Disable button to prevent double-clicks during popup
    googleBtn.disabled = true;
    googleBtn.textContent = 'Opening Google…';
    hideAlerts();

    try {
      // Open the Google account-chooser popup via Firebase
      const result = await signInWithPopup(auth, provider);

      // ── Extract user details from Google's response ──────
      const googleUser = result.user;

      const name         = googleUser.displayName  || 'FindMate User';
      const email        = googleUser.email        || '';
      const profileImage = googleUser.photoURL     || '';

      // ── Build a user object that matches the app's USER_KEY shape ──
      const user = { name, email, profileImage };

      // ── Exchange Firebase identity for a real FindMate JWT ─
      //   POST /api/auth/google  → returns { success, token, data: { user } }
      //   This gives us a real JWT so all existing auth guards work.
      const apiResponse = await fetch('http://localhost:5000/api/auth/google', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, email, profileImage }),
      });

      const apiData = await apiResponse.json();

      if (apiResponse.ok) {
        // ── Save real JWT + full user object ────────────────
        const token    = apiData.token || apiData.accessToken;
        const fullUser = apiData.data?.user || apiData.user || user;

        if (token) localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify({
          ...fullUser,
          // Always keep these three visible for navbar/profile use
          name,
          email,
          profileImage,
        }));
      } else {
        // Backend unavailable — fall back to Firebase-only session
        // (works offline; token won't pass protect() middleware)
        console.warn('Backend /api/auth/google failed:', apiData.message);
        localStorage.setItem(TOKEN_KEY, 'firebase_google');
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }

      // ── Show success feedback and redirect ───────────────
      showAlert('success', `✅ Welcome, ${name}! Redirecting you now…`);

      setTimeout(function () {
        window.location.href = DASHBOARD_PATH;
      }, 1200);

    } catch (error) {
      // Restore button state so the user can try again
      googleBtn.disabled = false;
      googleBtn.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google`;

      // Ignore popup-closed-by-user — no error message needed
      if (error.code === 'auth/popup-closed-by-user' ||
          error.code === 'auth/cancelled-popup-request') {
        return;
      }

      console.error('Google Sign-In error:', error);
      showAlert(
        'error',
        '⚠️ Google Sign-In failed. Please try again or use email/password.'
      );
    }
  });
}


// ─────────────────────────────────────────────────────────────
// SECTION 11: LIVE STATS  (Active Listings · Happy Matches · Cities)
//
// Fetches real counts from GET /api/stats and updates the three
// stat-number spans in the brand panel.
// Falls back silently to "—" if the server is unreachable.
// ─────────────────────────────────────────────────────────────

const API_STATS_URL = 'http://localhost:5000/api/stats';

/** Format a raw number into a compact display string.
 *  e.g. 12345 → "12K+"   5 → "5"   0 → "0" */
function formatStat(n) {
  if (n >= 1000) return Math.floor(n / 1000) + 'K+';
  return String(n);
}

async function loadLiveStats() {
  const elListings = document.getElementById('stat-listings');
  const elMatches  = document.getElementById('stat-matches');
  const elCities   = document.getElementById('stat-cities');

  if (!elListings || !elMatches || !elCities) return; // brand panel not present (mobile)

  try {
    const res  = await fetch(API_STATS_URL, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();

    if (json.success && json.data) {
      elListings.textContent = formatStat(json.data.activeListings);
      elMatches.textContent  = formatStat(json.data.happyMatches);
      elCities.textContent   = formatStat(json.data.cities);
    }
  } catch (_) {
    // Server down or slow — leave the "—" placeholders in place
    elListings.textContent = '—';
    elMatches.textContent  = '—';
    elCities.textContent   = '—';
  }
}

loadLiveStats();
