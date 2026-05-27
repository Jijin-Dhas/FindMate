// src/routes/reportRoutes.js
// ─────────────────────────────────────────────────────────
//  Report Routes — for regular users to submit reports
//
//  POST /api/reports  → any logged-in user can file a report
//
//  The admin routes (/api/admin/reports) handle reading them.
// ─────────────────────────────────────────────────────────

const express = require("express");
const router  = express.Router();

const { protect }    = require("../middleware/auth");
const { createReport } = require("../controllers/adminController");

// POST /api/reports — logged-in user submits a report
router.post("/", protect, createReport);

module.exports = router;
