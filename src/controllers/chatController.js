// src/controllers/chatController.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Chat Controller
//
//  Handles HTTP API routes for chat.
//  Real-time messaging is handled SEPARATELY in socketHandler.js.
//
//  ROUTES THIS CONTROLLER HANDLES:
//  ─────────────────────────────────────────────────────────
//  GET  /api/chat/history/:receiverId
//       → Fetch full message history between logged-in user
//         and the specified receiver. Sorted oldest→newest.
//
//  POST /api/chat/send
//       → Send a message via REST (non-socket fallback).
//         Also emits the message via Socket.IO for real-time.
//
//  GET  /api/chat/conversations
//       → List all unique users the logged-in user has chatted with,
//         with the latest message preview for each.
//
//  GET  /api/chat/users
//       → List all registered users (so we can start a new chat)
// ═══════════════════════════════════════════════════════════

const Message = require("../models/Message");
const User    = require("../models/User");
const { sendSuccess, sendError } = require("../utils/apiResponse");


// ─────────────────────────────────────────────────────────
//  GET /api/chat/history/:receiverId
//  Returns all messages between the current user and receiver.
//  Messages are sorted OLDEST first (so the chat reads top-down).
// ─────────────────────────────────────────────────────────
const getConversationHistory = async (req, res, next) => {
  try {
    const myId         = req.user._id;          // set by protect middleware
    const { receiverId } = req.params;

    // Validate that the receiver actually exists
    const receiver = await User.findById(receiverId).select("name email");
    if (!receiver) {
      return sendError(res, "User not found", 404);
    }

    // Fetch messages in BOTH directions between the two users:
    //   A→B  and  B→A
    const messages = await Message.find({
      $or: [
        { senderId: myId,       receiverId: receiverId },  // I sent to them
        { senderId: receiverId, receiverId: myId       },  // They sent to me
      ],
    })
      .populate("senderId",   "name")   // attach sender's name
      .populate("receiverId", "name")   // attach receiver's name
      .sort({ createdAt: 1 })           // oldest message first (top of chat)
      .limit(200);                      // safety cap — last 200 messages

    // Mark messages sent TO me as read
    await Message.updateMany(
      { senderId: receiverId, receiverId: myId, isRead: false },
      { isRead: true }
    );

    return sendSuccess(res, {
      messages,
      receiver: { _id: receiver._id, name: receiver.name, email: receiver.email },
    }, "Conversation loaded");

  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  POST /api/chat/send
//  REST fallback to send a message (Socket.IO is primary).
//  Body: { receiverId, message }
// ─────────────────────────────────────────────────────────
const sendMessage = async (req, res, next) => {
  try {
    const myId                 = req.user._id;
    const { receiverId, message } = req.body;

    // ── Input validation ──────────────────────────────────
    if (!receiverId || !message) {
      return sendError(res, "receiverId and message are required", 400);
    }

    // Trim whitespace — reject if empty after trimming
    const trimmedMessage = String(message).trim();
    if (!trimmedMessage) {
      return sendError(res, "Message cannot be empty", 400);
    }
    if (trimmedMessage.length > 2000) {
      return sendError(res, "Message too long (max 2000 characters)", 400);
    }

    // Prevent messaging yourself
    if (String(myId) === String(receiverId)) {
      return sendError(res, "You cannot message yourself", 400);
    }

    // Check receiver exists
    const receiver = await User.findById(receiverId).select("_id name");
    if (!receiver) {
      return sendError(res, "Receiver not found", 404);
    }

    // ── Save message to MongoDB ───────────────────────────
    const newMessage = await Message.create({
      senderId:   myId,
      receiverId: receiverId,
      message:    trimmedMessage,
    });

    // Populate sender name for the response
    const populated = await Message.findById(newMessage._id)
      .populate("senderId",   "name")
      .populate("receiverId", "name");

    // ── Emit via Socket.IO if available ──────────────────
    // req.app.get("io") gives us the Socket.IO instance
    // (we attach it in server.js)
    const io = req.app.get("io");
    if (io) {
      // Emit to the receiver's personal room
      io.to(String(receiverId)).emit("receiveMessage", {
        _id:        populated._id,
        senderId:   populated.senderId,
        receiverId: populated.receiverId,
        message:    populated.message,
        isRead:     populated.isRead,
        createdAt:  populated.createdAt,
      });
    }

    return sendSuccess(res, { message: populated }, "Message sent", 201);

  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  GET /api/chat/conversations
//  Returns a list of users I've had conversations with,
//  each with the latest message preview and unread count.
// ─────────────────────────────────────────────────────────
const getConversations = async (req, res, next) => {
  try {
    const myId = req.user._id;

    // Find all messages involving me
    const allMessages = await Message.find({
      $or: [
        { senderId:   myId },
        { receiverId: myId },
      ],
    })
      .populate("senderId",   "name email")
      .populate("receiverId", "name email")
      .sort({ createdAt: -1 }); // newest first

    // Build a map of conversations, keyed by the OTHER user's ID
    // We keep only the LATEST message per conversation
    const conversationMap = new Map();

    for (const msg of allMessages) {
      // Figure out who the OTHER person is
      const otherId = String(msg.senderId._id) === String(myId)
        ? String(msg.receiverId._id)
        : String(msg.senderId._id);

      const otherUser = String(msg.senderId._id) === String(myId)
        ? msg.receiverId
        : msg.senderId;

      if (!conversationMap.has(otherId)) {
        // Count unread messages from this user
        const unreadCount = await Message.countDocuments({
          senderId:   otherId,
          receiverId: myId,
          isRead:     false,
        });

        conversationMap.set(otherId, {
          userId:        otherUser._id,
          userName:      otherUser.name,
          userEmail:     otherUser.email,
          lastMessage:   msg.message,
          lastMessageAt: msg.createdAt,
          unreadCount,
        });
      }
    }

    // Convert Map to array, already sorted by latest message
    const conversations = Array.from(conversationMap.values());

    return sendSuccess(res, { conversations }, "Conversations loaded");

  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  GET /api/chat/users
//  Returns all users EXCEPT the logged-in user.
//  Used to start a new conversation.
// ─────────────────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const myId = req.user._id;

    const users = await User.find({ _id: { $ne: myId }, isActive: true })
      .select("name email city occupation")
      .sort({ name: 1 });

    return sendSuccess(res, { users }, "Users loaded");

  } catch (error) {
    next(error);
  }
};


module.exports = {
  getConversationHistory,
  sendMessage,
  getConversations,
  getAllUsers,
};
