// src/routes/authRoutes.js
// ─────────────────────────────────────────────────────────────
//  Defines the URL paths for authentication.
//  Routes connect a URL + HTTP method → controller function.
//
//  UPDATED: Added POST /google for Firebase Google Sign-In
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();

const { register, login, getMe, googleLogin } =
  require('../controllers/authController');

const { protect } = require('../middleware/auth');

// ── Public routes (no token needed) ──────────────────────────
router.post('/register', register);   // POST /api/auth/register
router.post('/login',    login);      // POST /api/auth/login

// NEW: Google Sign-In — receives Firebase user details,
// finds/creates a MongoDB user, and returns a real JWT.
router.post('/google',   googleLogin); // POST /api/auth/google

// ── Private route (token required) ───────────────────────────
router.get('/me', protect, getMe);    // GET  /api/auth/me

module.exports = router;
