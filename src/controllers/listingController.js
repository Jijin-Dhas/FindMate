// src/controllers/listingController.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Listing Controller  (UPDATED v4.0: Nearby Location Finder)
//
//  Changes from v3.0:
//  ✅ createListing — now parses nearbyPlaces[] and googleMapLink from FormData
//  ✅ updateListing — same parsing for updates
//  All other logic (auth, image upload, delete) is UNCHANGED.
//
//  HOW NEARBY PLACES ARE SENT FROM THE FRONTEND:
//  ───────────────────────────────────────────────
//  Because FormData only carries flat key-value pairs, each nearby place
//  is sent as THREE separate fields using array + bracket notation:
//
//    nearbyPlaces[0][name]     = "City Hospital"
//    nearbyPlaces[0][type]     = "hospital"
//    nearbyPlaces[0][distance] = "500 m"
//    nearbyPlaces[1][name]     = "Metro Bus Stand"
//    ...
//
//  Express with urlencoded parser automatically reconstructs this as:
//    req.body.nearbyPlaces = [
//      { name: "City Hospital", type: "hospital", distance: "500 m" },
//      { name: "Metro Bus Stand", ... }
//    ]
// ═══════════════════════════════════════════════════════════

const Listing             = require("../models/Listing");
const { deleteImageFile } = require("../middleware/upload");


// ─────────────────────────────────────────────────────────
//  HELPER: Parse & validate nearbyPlaces from request body
//  ─────────────────────────────────────────────────────────
//  Express might give us the array in different shapes depending on
//  how many entries the user submitted, so we normalize it here.
//
//  @param {any} raw — req.body.nearbyPlaces (could be array, object, or undefined)
//  @returns {Array} — cleaned array of { name, type, distance } objects
// ─────────────────────────────────────────────────────────
function parseNearbyPlaces(raw) {
  // If nothing was sent, return empty array (field is optional)
  if (!raw) return [];

  // Express sometimes gives an object { "0": {...}, "1": {...} } instead of
  // a proper array when only one item is in the list. Convert to array.
  let arr = Array.isArray(raw) ? raw : Object.values(raw);

  // Filter out any empty / incomplete entries the user left blank
  arr = arr.filter(
    (p) => p && typeof p === "object" && p.name && p.name.trim() && p.type
  );

  // Return cleaned entries (trim whitespace from strings)
  return arr.map((p) => ({
    name:     (p.name     || "").trim(),
    type:      p.type,
    distance: (p.distance || "").trim(),
  }));
}


// ─────────────────────────────────────────────────────────
//  @route   GET /api/listings
//  @desc    Get all available listings (with optional filters)
//  @access  Public — no login required
// ─────────────────────────────────────────────────────────
const getAllListings = async (req, res, next) => {
  try {
    // Build filter from URL query params
    // Example: GET /api/listings?city=Chennai&maxRent=15000&roomType=single
    const filter = { isAvailable: true };

    if (req.query.city) {
      filter["location.city"] = { $regex: req.query.city, $options: "i" };
    }
    if (req.query.maxRent) {
      filter["rent.amount"] = { $lte: Number(req.query.maxRent) };
    }
    if (req.query.roomType) {
      filter.roomType = req.query.roomType;
    }
    if (req.query.gender) {
      filter["preferredTenant.gender"] = req.query.gender;
    }

    // Pagination
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const listings = await Listing.find(filter)
      .populate("postedBy", "name email city")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Listing.countDocuments(filter);

    // Strip contactNumber before sending — phone is private; chat only
    const safeListings = listings.map(l => {
      const obj = l.toObject();
      delete obj.contactNumber;
      // DEBUG: log image paths being served
      if (obj.image) {
        console.log(`📋 [getAllListings] Listing "${obj.title}" image: ${obj.image}`);
      }
      return obj;
    });

    res.status(200).json({
      success: true,
      count: safeListings.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: { listings: safeListings },
    });

  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  @route   GET /api/listings/:id
//  @desc    Get a single listing by its MongoDB ID
//  @access  Public
// ─────────────────────────────────────────────────────────
const getListingById = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate("postedBy", "name email city");

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // Increment view counter
    listing.views += 1;
    await listing.save();

    // Strip contactNumber before sending — phone is private; chat only
    const safeListing = listing.toObject();
    delete safeListing.contactNumber;

    res.status(200).json({
      success: true,
      data: { listing: safeListing },
    });

  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  @route   POST /api/listings
//  @desc    Create a new listing (with optional image + nearby places)
//  @access  Private — JWT token required
//
//  Request: multipart/form-data
//  Fields:  title, description, location[city], rent[amount],
//           roomType, contactNumber, amenities, image (file),
//           nearbyPlaces[0][name], nearbyPlaces[0][type],
//           nearbyPlaces[0][distance], ..., googleMapLink
// ─────────────────────────────────────────────────────────
const createListing = async (req, res, next) => {
  try {
    // ── 1. Attach the logged-in user as the owner ──────────
    req.body.postedBy = req.user.id;

    // ── 2. Handle the uploaded image ───────────────────────
    // BUGFIX: req.file.path may be an absolute path like
    // "/home/user/project/uploads/listing-xxx.jpg" on some systems.
    // We normalize it to always store the RELATIVE path "uploads/listing-xxx.jpg"
    // so the frontend can build a correct URL from it.
    if (req.file) {
      const rawPath = req.file.path.replace(/\\/g, "/");
      // Extract just the "uploads/filename.ext" portion
      const uploadsIdx = rawPath.lastIndexOf("uploads/");
      req.body.image = uploadsIdx !== -1 ? rawPath.slice(uploadsIdx) : rawPath;
      console.log("📸 [createListing] Image saved:", req.body.image);
    }

    // ── 3. Parse single amenity string → array ─────────────
    if (req.body.amenities && typeof req.body.amenities === "string") {
      req.body.amenities = [req.body.amenities];
    }

    // ── 4. Parse nearbyPlaces from FormData ────────────────
    // The helper function cleans and validates the array entries.
    req.body.nearbyPlaces = parseNearbyPlaces(req.body.nearbyPlaces);

    // ── 5. Handle googleMapLink (empty string → null) ──────
    // If the user didn't fill in the map link, don't store an empty string.
    if (!req.body.googleMapLink || req.body.googleMapLink.trim() === "") {
      req.body.googleMapLink = null;
    } else {
      req.body.googleMapLink = req.body.googleMapLink.trim();
    }

    // ── 6. Save to MongoDB ─────────────────────────────────
    const listing = await Listing.create(req.body);

    res.status(201).json({
      success: true,
      message: "Listing created successfully",
      data: { listing },
    });

  } catch (error) {
    // If DB save fails but we already saved an image file, clean it up
    if (req.file) {
      deleteImageFile(req.file.path.replace(/\\/g, "/"));
    }
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  @route   PUT /api/listings/:id
//  @desc    Update an existing listing (with optional new image/nearby places)
//  @access  Private — only the listing OWNER can update
// ─────────────────────────────────────────────────────────
const updateListing = async (req, res, next) => {
  try {
    // ── 1. Find the listing ────────────────────────────────
    let listing = await Listing.findById(req.params.id);

    if (!listing) {
      if (req.file) deleteImageFile(req.file.path.replace(/\\/g, "/"));
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    // ── 2. Ownership check ─────────────────────────────────
    if (listing.postedBy.toString() !== req.user.id) {
      if (req.file) deleteImageFile(req.file.path.replace(/\\/g, "/"));
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this listing",
      });
    }

    // ── 3. Handle image replacement ────────────────────────
    // BUGFIX: Same normalization as createListing — always store relative path
    if (req.file) {
      const rawPath = req.file.path.replace(/\\/g, "/");
      const uploadsIdx = rawPath.lastIndexOf("uploads/");
      const newImagePath = uploadsIdx !== -1 ? rawPath.slice(uploadsIdx) : rawPath;
      if (listing.image) {
        deleteImageFile(listing.image);
      }
      req.body.image = newImagePath;
      console.log("📸 [updateListing] Image replaced:", req.body.image);
    }

    // ── 4. Parse amenities ─────────────────────────────────
    if (req.body.amenities && typeof req.body.amenities === "string") {
      req.body.amenities = [req.body.amenities];
    }

    // ── 5. Parse nearbyPlaces ──────────────────────────────
    if (req.body.nearbyPlaces !== undefined) {
      req.body.nearbyPlaces = parseNearbyPlaces(req.body.nearbyPlaces);
    }

    // ── 6. Handle googleMapLink ────────────────────────────
    if (req.body.googleMapLink !== undefined) {
      if (!req.body.googleMapLink || req.body.googleMapLink.trim() === "") {
        req.body.googleMapLink = null;
      } else {
        req.body.googleMapLink = req.body.googleMapLink.trim();
      }
    }

    // ── 7. Save the update ─────────────────────────────────
    listing = await Listing.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new:           true, // return updated document
        runValidators: true, // run schema validators
      }
    );

    res.status(200).json({
      success: true,
      message: "Listing updated successfully",
      data: { listing },
    });

  } catch (error) {
    if (req.file) deleteImageFile(req.file.path.replace(/\\/g, "/"));
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  @route   DELETE /api/listings/:id
//  @desc    Delete a listing and its image file
//  @access  Private — only the listing OWNER can delete
// ─────────────────────────────────────────────────────────
const deleteListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    if (listing.postedBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this listing",
      });
    }

    // Delete image file from disk before removing from DB
    if (listing.image) {
      deleteImageFile(listing.image);
    }

    await listing.deleteOne();

    res.status(200).json({
      success: true,
      message: "Listing deleted successfully",
      data: {},
    });

  } catch (error) {
    next(error);
  }
};


module.exports = {
  getAllListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
};
