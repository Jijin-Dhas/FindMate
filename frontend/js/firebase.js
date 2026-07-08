// frontend/js/firebase.js
// ============================================================
//  FindMate – Firebase Configuration & Auth Setup
//
//  Purpose:
//    Initialises the Firebase app and exports the tools that
//    login.js needs to run Google Sign-In via a popup.
//
//  Why CDN-only?
//    This project uses plain HTML/JS (no bundler).
//    Firebase v10 supports ES-module CDN imports, which work
//    directly in <script type="module"> tags — no npm needed.
//
//  Firebase version: 10.12.2
//  CDN base: https://www.gstatic.com/firebasejs/10.12.2/
// ============================================================


// ─────────────────────────────────────────────────────────────
// SECTION 1: IMPORT FIREBASE SDKs FROM CDN
//
// We import only what we need (tree-shaking at CDN level):
//   • firebase-app      – core Firebase initialisation
//   • firebase-auth     – authentication (Google Sign-In)
// ─────────────────────────────────────────────────────────────

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
}
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';


// ─────────────────────────────────────────────────────────────
// SECTION 2: FIREBASE PROJECT CONFIGURATION
//
// These values come from the Firebase Console:
//   Project Settings → Your apps → Web app → SDK setup
//
// ⚠️  IMPORTANT: Replace every placeholder below with your
//     real Firebase project credentials before deploying.
//
// These keys are safe to expose in frontend code —
// access is controlled by Firebase Security Rules and your
// authorised domain list in the Firebase Console.
// ─────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '....',
  messagingSenderId: '...',
  appId: '...'
};


// ─────────────────────────────────────────────────────────────
// SECTION 3: INITIALISE FIREBASE APP
//
// initializeApp() must be called once before any other Firebase
// service is used. It registers this project with the SDK.
// ─────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);


// ─────────────────────────────────────────────────────────────
// SECTION 4: INITIALISE FIREBASE AUTH
//
// getAuth() returns the Auth instance tied to our app.
// We'll pass this to signInWithPopup() in login.js.
// ─────────────────────────────────────────────────────────────

const auth = getAuth(app);


// ─────────────────────────────────────────────────────────────
// SECTION 5: CREATE GOOGLE AUTH PROVIDER
//
// GoogleAuthProvider() configures which OAuth provider to use.
// You can optionally add scopes here, e.g.:
//   provider.addScope('https://www.googleapis.com/auth/calendar');
// For FindMate we only need the default profile + email scopes.
// ─────────────────────────────────────────────────────────────

const provider = new GoogleAuthProvider();

// Force Google to always show the account-chooser popup,
// even if only one account is signed in on the device.
provider.setCustomParameters({ prompt: 'select_account' });


// ─────────────────────────────────────────────────────────────
// SECTION 6: EXPORTS
//
// login.js imports these three items:
//   • auth           – the Firebase Auth instance
//   • provider       – the configured GoogleAuthProvider
//   • signInWithPopup – function that opens the Google popup
// ─────────────────────────────────────────────────────────────

export { auth, provider, signInWithPopup };
