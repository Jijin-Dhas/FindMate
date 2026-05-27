// src/routes/statsRoutes.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Public Stats Route
//
//  GET /api/stats  → returns live counts for Login/Register pages
//  No authentication required (public endpoint)
// ═══════════════════════════════════════════════════════════

const express  = require("express");
const router   = express.Router();
const Listing  = require("../models/Listing");
const Message  = require("../models/Message");

// GET /api/stats
router.get("/", async (req, res) => {
  try {
    // Active Listings: all listings marked as available
    const activeListings = await Listing.countDocuments({ isAvailable: true });

    // Cities: count of distinct cities across all listings
    const citiesArr = await Listing.distinct("location.city");
    const cities    = citiesArr.length;

    // Happy Matches: unique conversation pairs (each pair = 1 connection)
    // A conversation is a unique (senderId, receiverId) OR (receiverId, senderId) pair.
    const convos = await Message.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $lt: ["$senderId", "$receiverId"] },
              { a: "$senderId", b: "$receiverId" },
              { a: "$receiverId", b: "$senderId" },
            ],
          },
        },
      },
      { $count: "total" },
    ]);
    const happyMatches = convos.length > 0 ? convos[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        activeListings,
        happyMatches,
        cities,
      },
    });
  } catch (err) {
    console.error("Stats route error:", err);
    res.status(500).json({
      success: false,
      message: "Could not fetch stats",
      data: { activeListings: 0, happyMatches: 0, cities: 0 },
    });
  }
});

module.exports = router;
