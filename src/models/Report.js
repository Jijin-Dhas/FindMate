// src/models/Report.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Report Model  (NEW v6.0: Admin Dashboard)
//
//  Users can report:
//  1. A fake/spam listing  (targetType: "listing")
//  2. A spam/abusive user  (targetType: "user")
//
//  Admin sees all reports in the dashboard and can resolve them.
// ═══════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    // ─── WHO FILED THE REPORT ─────────────────────────────
    // Set from JWT token in the controller — never from request body.
    reportedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Reporter is required"],
    },

    // ─── WHAT IS BEING REPORTED ───────────────────────────
    // "listing" = a room listing is fake/spam
    // "user"    = a user is spam/abusive
    targetType: {
      type:     String,
      enum:     ["listing", "user"],
      required: [true, "Target type is required"],
    },

    // If reporting a listing, store the listing's ObjectId here
    targetListing: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Listing",
      default: null,
    },

    // If reporting a user, store that user's ObjectId here
    targetUser: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    // ─── REASON FOR REPORT ────────────────────────────────
    reason: {
      type:      String,
      required:  [true, "Reason for report is required"],
      enum: [
        "fake_listing",
        "spam",
        "scam_fraud",
        "inappropriate_content",
        "harassment",
        "misleading_info",
        "abusive_behavior",
        "suspicious_user",
        "other",
      ],
    },

    // Optional additional details from the reporter
    description: {
      type:      String,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default:   "",
    },

    // ─── ADMIN STATUS ─────────────────────────────────────
    // "pending"  = not yet reviewed by admin (default)
    // "resolved" = admin has reviewed and taken action
    // "dismissed"= admin reviewed but no action needed
    status: {
      type:    String,
      enum:    ["pending", "resolved", "dismissed"],
      default: "pending",
    },

    // When the admin resolved/dismissed this report
    resolvedAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
