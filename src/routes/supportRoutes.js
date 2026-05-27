// src/routes/supportRoutes.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Support Routes  (NEW v5.0)
//
//  Mounted at /api/support in app.js.
//
//  Route table:
//  ┌──────────────────┬────────┬──────────────────────────────┐
//  │ URL              │ Method │ Description                  │
//  ├──────────────────┼────────┼──────────────────────────────┤
//  │ POST /api/support│ Public │ Submit a support ticket      │
//  │ GET  /api/support│ Public │ List all tickets (admin use) │
//  └──────────────────┴────────┴──────────────────────────────┘
//
//  NOTE ON AUTHENTICATION:
//  ─────────────────────────
//  POST is intentionally public so logged-out users (guests)
//  can still submit support tickets.
//
//  We use a special "optionalAuth" approach: if a valid JWT
//  token is present in the Authorization header, we attach
//  req.user — but we don't REJECT the request if it's missing.
//
//  This is different from the `protect` middleware used on
//  other routes (like /api/listings POST) which always requires
//  a valid token.
// ═══════════════════════════════════════════════════════════

const express = require("express");
const router  = express.Router();

const {
  submitSupportRequest,
  getSupportRequests,
} = require("../controllers/supportController");

// We need the JWT secret to optionally decode the token
const jwt  = require("jsonwebtoken");
const User = require("../models/User");


// ─────────────────────────────────────────────────────────
//  OPTIONAL AUTH MIDDLEWARE
//  ─────────────────────────────────────────────────────────
//  Unlike `protect`, this does NOT reject the request if
//  there's no token. It just TRIES to decode the token.
//  If it succeeds → req.user is set.
//  If it fails or is missing → req.user stays undefined.
//  Either way: next() is always called.
// ─────────────────────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists and starts with "Bearer "
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      // Verify the token (throws if invalid/expired)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach the user to req (without password field)
      req.user = await User.findById(decoded.id);
    }
    // No token? That's fine — just move on
  } catch {
    // Invalid/expired token — ignore it silently, treat as guest
  }

  next(); // always proceed
};


// ── ROUTES ────────────────────────────────────────────────

// POST /api/support  →  Submit a support ticket
// Uses optionalAuth so logged-in users get their ticket linked to their account
router.post("/", optionalAuth, submitSupportRequest);

// GET /api/support   →  List all tickets
// In production: protect this with an admin role check
router.get("/", getSupportRequests);


module.exports = router;
