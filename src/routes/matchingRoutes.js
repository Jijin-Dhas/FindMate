// src/routes/matchingRoutes.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Matching Routes
//
//  These routes return listings sorted by compatibility score.
//  ALL routes here require the user to be logged in.
//
//  Available routes:
//  ─────────────────────────────────────────────────────────
//  GET /api/matchings
//    → Returns ALL listings sorted by highest match score first
//    → Optional query params: ?page=1&limit=20&roomType=single
//
//  GET /api/matchings/preview/:listingId
//    → Returns match score for a SINGLE specific listing
//    → Useful on the listing detail page
// ═══════════════════════════════════════════════════════════

const express = require("express");
const router  = express.Router();

// Import the controller functions
const {
  getMatchedListings,
  getMatchScoreForListing,
} = require("../controllers/matchingController");

// Import the auth middleware (protects routes — login required)
const { protect } = require("../middleware/auth");

// ── Route definitions ──────────────────────────────────────

// GET /api/matchings
// Returns all listings sorted by match score (requires login)
router.get("/", protect, getMatchedListings);

// GET /api/matchings/preview/:listingId
// Returns match score for one specific listing (requires login)
router.get("/preview/:listingId", protect, getMatchScoreForListing);

module.exports = router;
