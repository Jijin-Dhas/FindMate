// src/routes/adminRoutes.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Admin Routes  (NEW v6.0)
//
//  ALL routes here require:
//  1. protect  → valid JWT token (logged in)
//  2. isAdmin  → user.role === "admin"
//
//  Regular users will get 403 Forbidden on any of these.
//
//  Base path: /api/admin  (mounted in app.js)
// ═══════════════════════════════════════════════════════════

const express = require("express");
const router  = express.Router();

const { protect, isAdmin } = require("../middleware/auth");
const {
  // Stats
  getDashboardStats,
  // Users
  getAllUsers,
  deleteUser,
  blockUser,
  unblockUser,
  // Listings
  getAllListings,
  deleteListing,
  verifyListing,
  rejectListing,
  // Reviews
  getAllReviews,
  deleteReview,
  // Reports
  createReport,
  getAllReports,
  resolveReport,
  deleteReport,
} = require("../controllers/adminController");


// ── Apply protect + isAdmin to all routes below ───────────
// Instead of adding the middleware to every route, we apply
// them once here using router.use(). Any route added below
// this line will automatically require admin access.
router.use(protect, isAdmin);


// ─── DASHBOARD STATS ──────────────────────────────────────
// GET /api/admin/stats
router.get("/stats", getDashboardStats);


// ─── USER MANAGEMENT ──────────────────────────────────────
// GET    /api/admin/users            → list all users
// DELETE /api/admin/users/:id        → delete a user
// PATCH  /api/admin/users/:id/block  → block user
// PATCH  /api/admin/users/:id/unblock→ unblock user
router.get("/users",             getAllUsers);
router.delete("/users/:id",      deleteUser);
router.patch("/users/:id/block", blockUser);
router.patch("/users/:id/unblock", unblockUser);


// ─── LISTING MANAGEMENT ───────────────────────────────────
// GET    /api/admin/listings            → list all listings
// DELETE /api/admin/listings/:id        → delete a listing
// PATCH  /api/admin/listings/:id/verify → approve listing
// PATCH  /api/admin/listings/:id/reject → reject listing
router.get("/listings",              getAllListings);
router.delete("/listings/:id",       deleteListing);
router.patch("/listings/:id/verify", verifyListing);
router.patch("/listings/:id/reject", rejectListing);


// ─── REVIEW MANAGEMENT ────────────────────────────────────
// GET    /api/admin/reviews      → list all reviews
// DELETE /api/admin/reviews/:id  → delete a review
router.get("/reviews",         getAllReviews);
router.delete("/reviews/:id",  deleteReview);


// ─── REPORT MANAGEMENT ────────────────────────────────────
// GET    /api/admin/reports              → list reports (admin)
// PATCH  /api/admin/reports/:id/resolve  → resolve/dismiss
// DELETE /api/admin/reports/:id          → delete report
router.get("/reports",               getAllReports);
router.patch("/reports/:id/resolve", resolveReport);
router.delete("/reports/:id",        deleteReport);


module.exports = router;
