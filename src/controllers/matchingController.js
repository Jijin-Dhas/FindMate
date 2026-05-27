// src/controllers/matchingController.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Matching Controller
//
//  This controller handles the GET /api/matchings route.
//
//  WHAT IT DOES:
//  1. Gets the logged-in user's profile (from req.user via JWT)
//  2. Fetches all available listings from the database
//  3. Runs the compatibility algorithm on each listing
//  4. Sorts listings from HIGHEST match score to LOWEST
//  5. Returns the sorted list with scores to the frontend
//
//  REQUIRES: User must be logged in (uses `protect` middleware)
// ═══════════════════════════════════════════════════════════

const Listing = require("../models/Listing");
const User    = require("../models/User");
const { calculateCompatibilityScore } = require("../utils/matchingAlgorithm");
const { sendSuccess, sendError }      = require("../utils/apiResponse");


// ─────────────────────────────────────────────────────────
//  @route   GET /api/matchings
//  @desc    Get all listings sorted by compatibility score
//  @access  Private (requires login token)
// ─────────────────────────────────────────────────────────
const getMatchedListings = async (req, res, next) => {
  try {
    // ── STEP 1: Get the logged-in user's full profile ──────
    // req.user is set by the `protect` middleware (auth.js)
    // We re-fetch to make sure we have the latest profile data
    const userProfile = await User.findById(req.user._id);

    if (!userProfile) {
      return sendError(res, "User not found. Please log in again.", 401);
    }

    // ── STEP 2: Get optional query filters ─────────────────
    // Users can still filter by room type or city from the URL
    // Example: GET /api/matchings?roomType=single&limit=20
    const page     = Math.max(1, Number(req.query.page)  || 1);
    const limit    = Math.min(100, Number(req.query.limit) || 50); // max 100
    const roomType = req.query.roomType || null;

    // ── STEP 3: Build the database query ──────────────────
    // Fetch all available listings
    // We populate postedBy so we have lister's preferences for matching
    const dbFilter = { isAvailable: true };

    // If user wants to filter by room type
    if (roomType) {
      dbFilter.roomType = roomType;
    }

    // Fetch listings with lister's profile data (needed for smoking/food match)
    // We select specific fields from the User to avoid exposing passwords etc.
    const listings = await Listing.find(dbFilter)
      .populate("postedBy", "name email city phone smokingPreference foodPreference occupation gender")
      .limit(limit * page) // fetch enough for pagination
      .lean(); // .lean() returns plain JS objects (faster than Mongoose docs)

    if (!listings || listings.length === 0) {
      return sendSuccess(res, { listings: [], total: 0 }, "No listings found.");
    }

    // ── STEP 4: Calculate match score for each listing ─────
    // This is where the magic happens!
    // We loop through every listing and compute its compatibility score.
    const scoredListings = listings.map((listing) => {
      // Run the compatibility algorithm
      const matchResult = calculateCompatibilityScore(userProfile, listing);

      // Return the listing with the match data attached
      return {
        ...listing,                       // all original listing fields
        matchScore:     matchResult.score,        // e.g. 78
        matchLabel:     matchResult.label,        // e.g. "Great Match"
        matchColor:     matchResult.color,        // e.g. "#22c55e"
        matchBreakdown: matchResult.breakdown,    // detailed factor scores
      };
    });

    // ── STEP 5: Sort listings by score (highest first) ─────
    // Sort in descending order: 95, 82, 70, 55, 30...
    scoredListings.sort((a, b) => b.matchScore - a.matchScore);

    // ── STEP 6: Apply pagination ───────────────────────────
    const startIndex = (page - 1) * limit;
    const endIndex   = startIndex + limit;
    const paginatedListings = scoredListings.slice(startIndex, endIndex);

    // ── STEP 7: Send the response ──────────────────────────
    return sendSuccess(
      res,
      {
        listings:    paginatedListings,
        total:       scoredListings.length,
        totalPages:  Math.ceil(scoredListings.length / limit),
        currentPage: page,
        // Include user's profile summary so frontend can display it
        userProfile: {
          name:              userProfile.name,
          city:              userProfile.city,
          budget:            userProfile.budget,
          gender:            userProfile.gender,
          smokingPreference: userProfile.smokingPreference,
          foodPreference:    userProfile.foodPreference,
          occupation:        userProfile.occupation,
          profileComplete:   userProfile.profileComplete,
        },
      },
      "Listings sorted by compatibility"
    );

  } catch (error) {
    // Pass error to the global error handler (errorHandler.js)
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  @route   GET /api/matchings/preview
//  @desc    Get match score for a SINGLE listing by ID
//           Useful for showing score on listing detail page
//  @access  Private
// ─────────────────────────────────────────────────────────
const getMatchScoreForListing = async (req, res, next) => {
  try {
    const { listingId } = req.params;

    // Fetch the specific listing
    const listing = await Listing.findById(listingId)
      .populate("postedBy", "name smokingPreference foodPreference occupation gender")
      .lean();

    if (!listing) {
      return sendError(res, "Listing not found", 404);
    }

    // Get the user's profile
    const userProfile = await User.findById(req.user._id);

    // Calculate score for this one listing
    const matchResult = calculateCompatibilityScore(userProfile, listing);

    return sendSuccess(res, {
      listingId: listingId,
      matchScore:     matchResult.score,
      matchLabel:     matchResult.label,
      matchColor:     matchResult.color,
      matchBreakdown: matchResult.breakdown,
    }, "Match score calculated");

  } catch (error) {
    next(error);
  }
};


module.exports = {
  getMatchedListings,
  getMatchScoreForListing,
};
