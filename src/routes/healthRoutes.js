// src/routes/healthRoutes.js
// ─────────────────────────────────────────────────────────
//  A simple "health check" route. Useful to verify:
//  - Is the server running?
//  - Is the database connected?
//  Tools like Render, Railway, or uptime monitors ping this.
// ─────────────────────────────────────────────────────────

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// GET /api/health
router.get("/", (req, res) => {
  const dbStatus = mongoose.connection.readyState;

  // Mongoose connection states: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbStatusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.status(200).json({
    success: true,
    message: "FindMate API is running 🚀",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatusMap[dbStatus] || "unknown",
      name: mongoose.connection.name || "N/A",
    },
  });
});

module.exports = router;
