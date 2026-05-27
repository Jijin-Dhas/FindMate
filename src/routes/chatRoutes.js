// src/routes/chatRoutes.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Chat API Routes
//
//  All routes require authentication (protect middleware).
//  Real-time messaging uses Socket.IO (see socketHandler.js).
//  These REST routes handle history, user lists, and fallback sending.
//
//  BASE PATH: /api/chat  (mounted in app.js)
//
//  ROUTE SUMMARY:
//  ─────────────────────────────────────────────────────────
//  GET  /api/chat/users                  → all users (to start chat)
//  GET  /api/chat/conversations          → my conversation list
//  GET  /api/chat/history/:receiverId    → message history with one user
//  POST /api/chat/send                   → send a message (REST fallback)
// ═══════════════════════════════════════════════════════════

const express = require("express");
const router  = express.Router();

const {
  getConversationHistory,
  sendMessage,
  getConversations,
  getAllUsers,
} = require("../controllers/chatController");

const { protect } = require("../middleware/auth");

// ALL chat routes require login
router.use(protect);

// GET /api/chat/users
// Returns all users so we can start a new conversation
router.get("/users", getAllUsers);

// GET /api/chat/conversations
// Returns list of conversations with latest message preview
router.get("/conversations", getConversations);

// GET /api/chat/history/:receiverId
// Returns full message history with a specific user
router.get("/history/:receiverId", getConversationHistory);

// POST /api/chat/send
// REST-based message sending (also triggers Socket.IO emit)
// Body: { receiverId, message }
router.post("/send", sendMessage);

module.exports = router;
