// src/routes/profileRoutes.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Profile Routes
//
//  All routes here are PROTECTED — meaning the user must
//  send a valid JWT token in the Authorization header.
//
//  How the protect middleware works:
//  1. It reads the "Authorization: Bearer <token>" header
//  2. It verifies the token with our JWT_SECRET
//  3. It loads the user from MongoDB and puts them in req.user
//  4. Only then does the actual controller function run
//
//  Routes:
//  GET  /api/profile   → fetch logged-in user's profile
//  PUT  /api/profile   → update logged-in user's profile
// ═══════════════════════════════════════════════════════════

const express = require("express");
const router  = express.Router();

const { getProfile, updateProfile } = require("../controllers/profileController");
const { protect }                   = require("../middleware/auth");

// Both routes require a valid token — protect runs first
router.get("/",  protect, getProfile);    // GET  /api/profile
router.put("/",  protect, updateProfile); // PUT  /api/profile

module.exports = router;
