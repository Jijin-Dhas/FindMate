// src/models/Support.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Support Ticket Model  (NEW v5.0)
//
//  A "Support" document is created every time someone fills
//  out the Help & Support contact form.
//
//  It stores who sent it, what category the issue falls under,
//  and the full message — so the FindMate support team can
//  respond to and track user issues.
//
//  Schema overview:
//  ┌─────────────┬──────────────────────────────────────────┐
//  │ name        │ Sender's full name (required)            │
//  │ email       │ Sender's email — for reply (required)    │
//  │ category    │ Issue type from dropdown (required)      │
//  │ message     │ Detailed description (required, 20–2000) │
//  │ status      │ open → in_progress → resolved            │
//  │ userId      │ Optional — linked User if logged in      │
//  │ createdAt   │ Auto timestamp                           │
//  │ updatedAt   │ Auto timestamp                           │
//  └─────────────┴──────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const supportSchema = new mongoose.Schema(
  {
    // ─── SENDER DETAILS ───────────────────────────────────
    // We store name and email directly (not just a User ref)
    // so that even logged-out guests can submit support tickets.
    name: {
      type:      String,
      required:  [true, "Name is required"],
      trim:      true,
      minlength: [2,   "Name must be at least 2 characters"],
      maxlength: [80,  "Name cannot exceed 80 characters"],
    },

    email: {
      type:      String,
      required:  [true, "Email is required"],
      trim:      true,
      lowercase: true, // always stored in lowercase
      match: [
        // Standard email format validation
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        "Please enter a valid email address",
      ],
    },

    // ─── ISSUE CATEGORY ───────────────────────────────────
    // Dropdown choices — helps the support team route tickets
    // to the right person quickly.
    category: {
      type:     String,
      required: [true, "Please select a category"],
      enum: {
        values: [
          "account",      // Login, password, profile issues
          "listing",      // Problems with room listings
          "roommate",     // Roommate matching issues
          "chat",         // Chat / messaging problems
          "safety",       // Safety concerns, scam reports
          "technical",    // Bugs, errors, app not loading
          "billing",      // Payments, subscriptions
          "other",        // Anything that doesn't fit above
        ],
        message: "Please select a valid support category",
      },
    },

    // ─── MESSAGE ──────────────────────────────────────────
    // The full description of the user's issue.
    // 20 chars minimum ensures we get enough context.
    message: {
      type:      String,
      required:  [true, "Message is required"],
      trim:      true,
      minlength: [20,   "Please describe your issue in more detail (min 20 characters)"],
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },

    // ─── TICKET STATUS ────────────────────────────────────
    // Tracks the lifecycle of a support request.
    // "open"        → just submitted, not yet seen
    // "in_progress" → team is working on it
    // "resolved"    → issue fixed and closed
    status: {
      type:    String,
      enum:    ["open", "in_progress", "resolved"],
      default: "open", // every new ticket starts as open
    },

    // ─── OPTIONAL USER LINK ───────────────────────────────
    // If the user is logged in when they submit, we save their
    // User ID so the support team can look up their account.
    // This field is optional — guests can submit without logging in.
    userId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },
  },
  {
    // Mongoose automatically adds createdAt and updatedAt
    timestamps: true,
  }
);

// ─── INDEX ────────────────────────────────────────────────
// Speed up "show all open tickets" queries (admin dashboard)
supportSchema.index({ status: 1, createdAt: -1 });
// Speed up "find tickets by email" queries
supportSchema.index({ email: 1 });

module.exports = mongoose.model("Support", supportSchema);
