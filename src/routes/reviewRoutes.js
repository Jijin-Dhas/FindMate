// src/routes/reviewRoutes.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Review Routes  (NEW in v4.0)
//
//  All routes are prefixed with /api/reviews (set in app.js).
//
//  Route table:
//  ┌────────────────────────────────────────┬────────┬────────────────────────────┐
//  │ Full URL                               │ Method │ Description                │
//  ├────────────────────────────────────────┼────────┼────────────────────────────┤
//  │ GET  /api/reviews/:listingId           │ Public │ All reviews for a listing  │
//  │ POST /api/reviews/:listingId           │ 🔒 JWT │ Add a new review            │
//  │ DELETE /api/reviews/:reviewId          │ 🔒 JWT │ Delete own review           │
//  └────────────────────────────────────────┴────────┴────────────────────────────┘
//
//  MIDDLEWARE ORDER FOR PRIVATE ROUTES:
//    protect → controller
//    protect: checks JWT, sets req.user
// ═══════════════════════════════════════════════════════════

const express = require("express");
const router  = express.Router();

const {
  getReviewsByListing,
  addReview,
  deleteReview,
} = require("../controllers/reviewController");

const { protect } = require("../middleware/auth");


// ── PUBLIC ────────────────────────────────────────────────

// GET /api/reviews/:listingId
// → Returns all reviews + stats for a specific listing
// → No login needed — anyone can read reviews
router.get("/:listingId", getReviewsByListing);


// ── PRIVATE (JWT required) ────────────────────────────────

// POST /api/reviews/:listingId
// → Submit a new review for a listing
// → Must be logged in (protect middleware checks JWT)
router.post("/:listingId", protect, addReview);

// DELETE /api/reviews/:reviewId
// → Delete a review you wrote
// → Must be logged in AND be the original reviewer
router.delete("/:reviewId", protect, deleteReview);


module.exports = router;
