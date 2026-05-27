// src/models/Listing.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Listing Model  (UPDATED v6.0: Admin Dashboard)
//
//  Changes from v5.0:
//  ✅ Added: verificationStatus field
//             "pending" | "verified" | "rejected"
//
//  All previous fields (nearbyPlaces, googleMapLink, etc.)
//  are UNCHANGED.
// ═══════════════════════════════════════════════════════════

const mongoose = require("mongoose");

// Sub-schema for nearby places
const nearbyPlaceSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, "Place name is required"],
      trim:      true,
      maxlength: [100, "Place name cannot exceed 100 characters"],
    },
    type: {
      type:     String,
      required: [true, "Place type is required"],
      enum: {
        values:  ["college", "hospital", "bus_stop", "supermarket", "restaurant"],
        message: "Place type must be one of: college, hospital, bus_stop, supermarket, restaurant",
      },
    },
    distance: { type: String, trim: true, maxlength: 50, default: "" },
  },
  { _id: false }
);

const listingSchema = new mongoose.Schema(
  {
    // Who posted this listing
    postedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "A listing must belong to a user"],
    },

    title: {
      type:      String,
      required:  [true, "Title is required"],
      trim:      true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },

    description: {
      type:      String,
      required:  [true, "Description is required"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    location: {
      city:    { type: String, required: [true, "City is required"], trim: true },
      area:    { type: String, trim: true },
      address: { type: String, trim: true, select: false },
    },

    rent: {
      amount:       { type: Number, required: [true, "Rent amount is required"], min: 0 },
      currency:     { type: String, default: "INR" },
      isNegotiable: { type: Boolean, default: false },
    },

    roomType: {
      type:     String,
      enum:     ["single", "shared", "entire_flat", "pg"],
      required: [true, "Room type is required"],
    },

    amenities: { type: [String], default: [] },

    preferredTenant: {
      gender:           { type: String, enum: ["male","female","any"], default: "any" },
      studentOrWorking: { type: String, enum: ["student","working","any"], default: "any" },
    },

    availableFrom: { type: Date, default: Date.now },
    contactNumber: { type: String, trim: true, default: null },

    image:  { type: String, default: null },
    images: { type: [String], default: [] },

    // Nearby places (v4.0)
    nearbyPlaces: {
      type:     [nearbyPlaceSchema],
      default:  [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message:   "You can add at most 20 nearby places",
      },
    },

    // Google Maps embed URL (v4.0)
    googleMapLink: {
      type:    String,
      trim:    true,
      default: null,
      validate: {
        validator: function (val) {
          if (!val) return true;
          return (
            val.startsWith("https://www.google.com/maps/") ||
            val.startsWith("https://maps.google.com/")
          );
        },
        message: "Google Map link must be a valid Google Maps embed URL",
      },
    },

    isAvailable: { type: Boolean, default: true },
    views:       { type: Number,  default: 0 },

    // ─── ADMIN VERIFICATION (NEW v6.0) ────────────────────
    // "pending"  = just submitted, waiting for admin review
    // "verified" = admin approved — shown with a verified badge
    // "rejected" = admin rejected the listing
    verificationStatus: {
      type:    String,
      enum:    ["pending", "verified", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
listingSchema.index({ "location.city": 1 });
listingSchema.index({ "rent.amount": 1 });

module.exports = mongoose.model("Listing", listingSchema);
