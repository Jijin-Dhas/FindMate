// src/routes/listingRoutes.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Listing Routes  (UPDATED v3.0: Image Upload)
//
//  Changes from v2.0:
//  ✅ POST /api/listings  — now includes handleUpload middleware
//  ✅ PUT  /api/listings/:id — now includes handleUpload middleware
//
//  MIDDLEWARE ORDER MATTERS:
//  ──────────────────────────
//  For routes that accept file uploads, the order is:
//    1. protect      → checks JWT, sets req.user
//    2. handleUpload → reads the file, sets req.file
//    3. controller   → runs the business logic using req.user & req.file
//
//  If protect fails:      stops here, returns 401
//  If handleUpload fails: stops here, returns 400 (bad file)
//  If both pass:          controller runs with req.user and req.file
// ═══════════════════════════════════════════════════════════

const express = require("express");
const router  = express.Router();

// Controller functions
const {
  getAllListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
} = require("../controllers/listingController");

// Auth middleware: verifies JWT, sets req.user
const { protect } = require("../middleware/auth");

// Image upload middleware: reads file, sets req.file
const { handleUpload } = require("../middleware/upload");


// ── PUBLIC ROUTES (no login needed) ───────────────────────

// GET /api/listings          → browse all listings
router.get("/", getAllListings);

// GET /api/listings/:id      → view a single listing
router.get("/:id", getListingById);


// ── PRIVATE ROUTES (JWT token required) ───────────────────

// POST /api/listings         → create a new listing with optional image
// Request type: multipart/form-data (because of file upload)
router.post(
  "/",
  protect,        // 1st: check login
  handleUpload,   // 2nd: process image file (if any)
  createListing   // 3rd: save to database
);

// PUT /api/listings/:id      → update listing, optionally replace image
// Request type: multipart/form-data (because of file upload)
router.put(
  "/:id",
  protect,        // 1st: check login
  handleUpload,   // 2nd: process new image file (if any)
  updateListing   // 3rd: update in database
);

// DELETE /api/listings/:id   → delete listing + its image file
// Regular JSON request (no file upload)
router.delete("/:id", protect, deleteListing);


module.exports = router;
