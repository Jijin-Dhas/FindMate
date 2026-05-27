// src/models/Review.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Review Model  (NEW in v4.0)
//
//  A "Review" is a star rating + written comment that a user
//  leaves on a room listing after interacting with it.
//
//  Schema at a glance:
//  ┌──────────────┬──────────────────────────────────────────┐
//  │ reviewer     │ ObjectId → User who wrote the review     │
//  │ listing      │ ObjectId → Listing being reviewed        │
//  │ rating       │ Number 1–5  (1=Poor, 5=Excellent)        │
//  │ comment      │ String, 10–500 chars                     │
//  │ createdAt    │ Date (auto by timestamps: true)          │
//  │ updatedAt    │ Date (auto by timestamps: true)          │
//  └──────────────┴──────────────────────────────────────────┘
//
//  KEY RULES:
//  ✅ One review per user per listing  (compound unique index)
//  ✅ Rating must be 1–5  (enum validation)
//  ✅ Comment is required  (min 10 chars)
//  ✅ Reviewer is set from req.user (JWT), never from req.body
// ═══════════════════════════════════════════════════════════

const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    // ─── WHO WROTE THIS REVIEW ────────────────────────────
    // We store a reference to the User document (ObjectId).
    // Using .populate("reviewer") we can fetch name, email, etc.
    // This is set in the controller from req.user.id (JWT).
    // NEVER trust the frontend to send the reviewer's id.
    reviewer: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Reviewer is required"],
    },

    // ─── WHICH LISTING IS BEING REVIEWED ─────────────────
    // Reference to the Listing document.
    // Comes from the URL parameter: POST /api/reviews/:listingId
    listing: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Listing",
      required: [true, "Listing reference is required"],
    },

    // ─── STAR RATING ──────────────────────────────────────
    // An integer from 1 to 5.
    //   1 = Poor       ⭐
    //   2 = Fair       ⭐⭐
    //   3 = Good       ⭐⭐⭐
    //   4 = Very Good  ⭐⭐⭐⭐
    //   5 = Excellent  ⭐⭐⭐⭐⭐
    rating: {
      type:     Number,
      required: [true, "Rating is required"],
      min:      [1, "Rating must be at least 1"],
      max:      [5, "Rating cannot exceed 5"],
      // enum ensures only whole numbers 1–5 are accepted
      enum: {
        values:  [1, 2, 3, 4, 5],
        message: "Rating must be a whole number between 1 and 5",
      },
    },

    // ─── WRITTEN COMMENT ──────────────────────────────────
    // The reviewer's text feedback about the listing.
    // Minimum 10 chars so we get meaningful reviews.
    comment: {
      type:      String,
      required:  [true, "Comment is required"],
      trim:      true,
      minlength: [10,  "Comment must be at least 10 characters"],
      maxlength: [500, "Comment cannot exceed 500 characters"],
    },
  },
  {
    // Mongoose automatically adds:
    //   createdAt — when the review was first written
    //   updatedAt — when the review was last edited
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────
//  COMPOUND UNIQUE INDEX
//  ─────────────────────────────────────────────────────────
//  This prevents the same user from submitting more than one
//  review for the same listing.
//
//  { reviewer: 1, listing: 1, unique: true } means:
//  The combination of (reviewer + listing) must be unique.
//  → User A can review Listing X once ✅
//  → User A cannot review Listing X again ❌
//  → User A can review Listing Y ✅
// ─────────────────────────────────────────────────────────
reviewSchema.index({ reviewer: 1, listing: 1 }, { unique: true });

// ─────────────────────────────────────────────────────────
//  INDEX FOR FAST LOOKUP
//  Fetching all reviews for a listing is the most common query.
//  This index makes it fast even with millions of reviews.
// ─────────────────────────────────────────────────────────
reviewSchema.index({ listing: 1, createdAt: -1 }); // listing reviews, newest first

module.exports = mongoose.model("Review", reviewSchema);
