// src/models/Message.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Message Model
//
//  PURPOSE:
//  Every chat message sent between two users is stored in
//  MongoDB using this schema.
//
//  FIELDS:
//  ─────────────────────────────────────────────────────────
//  senderId    → Who sent the message   (ref to User)
//  receiverId  → Who received it        (ref to User)
//  message     → The actual text
//  isRead      → Has the receiver seen it? (for future read receipts)
//  createdAt   → Timestamp (auto-added by Mongoose timestamps:true)
//
//  CONVERSATION KEY CONCEPT:
//  A "conversation" between User A and User B is simply all
//  messages where:
//    (senderId == A AND receiverId == B)
//    OR
//    (senderId == B AND receiverId == A)
//  We query with this pattern in the controller.
// ═══════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // ─── WHO SENT IT ──────────────────────────────────────
    senderId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",           // links to the User collection
      required: [true, "Sender is required"],
    },

    // ─── WHO RECEIVES IT ──────────────────────────────────
    receiverId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Receiver is required"],
    },

    // ─── THE MESSAGE TEXT ─────────────────────────────────
    message: {
      type:      String,
      required:  [true, "Message cannot be empty"],
      trim:      true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },

    // ─── READ STATUS ─────────────────────────────────────
    // false = not yet read by receiver, true = seen
    isRead: {
      type:    Boolean,
      default: false,
    },
  },
  {
    // Mongoose auto-adds createdAt and updatedAt fields
    // createdAt is used as our message timestamp
    timestamps: true,
  }
);

// ─── DATABASE INDEXES ─────────────────────────────────────
// Indexes make queries MUCH faster.
// We always query by senderId+receiverId together, so a
// compound index on both fields speeds up conversation fetches.
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ createdAt: 1 }); // for sorting by time

module.exports = mongoose.model("Message", messageSchema);
