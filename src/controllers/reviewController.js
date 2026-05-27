// src/controllers/reviewController.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Review Controller  (NEW in v4.0)
//
//  Contains all the business logic for reviews:
//
//  getReviewsByListing  → Public. Fetch all reviews for a listing,
//                         sorted newest-first, with reviewer names.
//                         Also computes averageRating and totalReviews.
//
//  addReview            → Private (JWT). Submit a new review.
//                         Prevents duplicates via the unique index.
//
//  deleteReview         → Private (JWT). Only the original reviewer
//                         can delete their own review.
// ═══════════════════════════════════════════════════════════

const Review  = require("../models/Review");
const Listing = require("../models/Listing");


// ─────────────────────────────────────────────────────────
//  @route   GET /api/reviews/:listingId
//  @desc    Get all reviews for a specific listing
//           + compute average rating and total count
//  @access  Public — no login needed
// ─────────────────────────────────────────────────────────
const getReviewsByListing = async (req, res, next) => {
  try {
    const { listingId } = req.params;

    // ── 1. Validate that the listing exists ───────────────
    // We do a lightweight check (just the _id) so we don't fetch
    // all listing fields unnecessarily.
    const listingExists = await Listing.exists({ _id: listingId });
    if (!listingExists) {
      return res.status(404).json({
        success: false,
        message:  "Listing not found",
      });
    }

    // ── 2. Fetch all reviews for this listing ─────────────
    // .populate("reviewer", "name") → swap the reviewer ObjectId
    // for the actual User document's name field only.
    // (We don't expose email or password in the review list.)
    const reviews = await Review.find({ listing: listingId })
      .populate("reviewer", "name")   // only fetch reviewer's name
      .sort({ createdAt: -1 });       // newest reviews appear first

    // ── 3. Compute statistics ─────────────────────────────
    // averageRating: add all ratings and divide by count
    // We use .toFixed(1) in the frontend for display, but here
    // we return the raw number so the frontend can format it.
    const totalReviews   = reviews.length;
    const averageRating  = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    // ── 4. Build rating distribution (breakdown per star) ─
    // Example: { 1: 0, 2: 1, 3: 2, 4: 5, 5: 8 }
    // Useful for showing a breakdown bar chart.
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        reviews,
        stats: {
          totalReviews,
          averageRating: Math.round(averageRating * 10) / 10, // round to 1 decimal
          distribution,
        },
      },
    });

  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  @route   POST /api/reviews/:listingId
//  @desc    Add a new review for a listing
//  @access  Private — JWT token required
//
//  Request body (JSON):
//    { "rating": 4, "comment": "Great place, very clean!" }
//
//  The reviewer is set from req.user.id (NOT from req.body)
//  so users can't impersonate others.
// ─────────────────────────────────────────────────────────
const addReview = async (req, res, next) => {
  try {
    const { listingId } = req.params;
    const { rating, comment } = req.body;

    // ── 1. Validate that the listing exists ───────────────
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message:  "Listing not found",
      });
    }

    // ── 2. Prevent owner from reviewing their own listing ─
    // It would be a conflict of interest to let someone
    // review their own room listing.
    if (listing.postedBy.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message:  "You cannot review your own listing",
      });
    }

    // ── 3. Validate required fields ───────────────────────
    // Express-validator is not used here; manual checks keep
    // the code beginner-friendly and explicit.
    if (!rating) {
      return res.status(400).json({
        success: false,
        message: "Please select a star rating (1–5)",
      });
    }

    if (!comment || comment.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Comment must be at least 10 characters",
      });
    }

    if (comment.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot exceed 500 characters",
      });
    }

    // ── 4. Create the review ──────────────────────────────
    // The reviewer is req.user.id from the JWT — never req.body.
    // If MongoDB's unique index fires (duplicate review),
    // it throws a code 11000 error which we catch below.
    const review = await Review.create({
      reviewer: req.user.id,   // from JWT middleware
      listing:  listingId,     // from URL param
      rating:   Number(rating),
      comment:  comment.trim(),
    });

    // ── 5. Populate reviewer name for immediate display ───
    // The newly created review only has the reviewer's ObjectId.
    // We populate it so the frontend can show the name right away
    // without making a second API call.
    await review.populate("reviewer", "name");

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data:    { review },
    });

  } catch (error) {
    // ── Handle duplicate review (unique index violation) ──
    // MongoDB error code 11000 = duplicate key error.
    // This fires when the (reviewer + listing) combination already exists.
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this listing. Each user can only leave one review per listing.",
      });
    }

    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  @route   DELETE /api/reviews/:reviewId
//  @desc    Delete a review (only by the original reviewer)
//  @access  Private — JWT token required
// ─────────────────────────────────────────────────────────
const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message:  "Review not found",
      });
    }

    // ── Ownership check ───────────────────────────────────
    // Only the user who wrote the review can delete it.
    if (review.reviewer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message:  "You can only delete your own reviews",
      });
    }

    await review.deleteOne();

    res.status(200).json({
      success: true,
      message: "Review deleted",
      data:    {},
    });

  } catch (error) {
    next(error);
  }
};


module.exports = {
  getReviewsByListing,
  addReview,
  deleteReview,
};
