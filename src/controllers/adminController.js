// src/controllers/adminController.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Admin Controller  (NEW v6.0)
//
//  All admin-only operations live here.
//  Every route that uses these controllers must be protected
//  by BOTH the `protect` AND `isAdmin` middlewares.
//
//  SECTIONS:
//  1. Dashboard Stats
//  2. User Management
//  3. Listing Management
//  4. Review Management
//  5. Report Management
// ═══════════════════════════════════════════════════════════

const User    = require("../models/User");
const Listing = require("../models/Listing");
const Review  = require("../models/Review");
const Report  = require("../models/Report");
const Message = require("../models/Message");


// ═══════════════════════════════════════════════════════════
//  SECTION 1 – DASHBOARD STATS
// ═══════════════════════════════════════════════════════════

// @route  GET /api/admin/stats
// @desc   Return platform-wide counts for the dashboard cards
// @access Admin only
const getDashboardStats = async (req, res, next) => {
  try {
    // Run all count queries in parallel for speed
    const [
      totalUsers,
      totalListings,
      activeListings,
      verifiedListings,
      totalReviews,
      totalChats,
      pendingReports,
      blockedUsers,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),          // all non-admin users
      Listing.countDocuments(),                        // all listings
      Listing.countDocuments({ isAvailable: true }),   // currently available
      Listing.countDocuments({ verificationStatus: "verified" }),
      Review.countDocuments(),
      Message.countDocuments(),                        // total chat messages
      Report.countDocuments({ status: "pending" }),    // unresolved reports
      User.countDocuments({ isBlocked: true }),        // blocked accounts
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalListings,
        activeListings,
        verifiedListings,
        totalReviews,
        totalChats,
        pendingReports,
        blockedUsers,
      },
    });
  } catch (error) {
    next(error);
  }
};


// ═══════════════════════════════════════════════════════════
//  SECTION 2 – USER MANAGEMENT
// ═══════════════════════════════════════════════════════════

// @route  GET /api/admin/users
// @desc   Get all users (paginated, latest first)
// @access Admin only
const getAllUsers = async (req, res, next) => {
  try {
    // Pagination: ?page=1&limit=20
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    // Optional search by name or email: ?search=john
    const search = req.query.search || "";
    const filter = search
      ? {
          $or: [
            { name:  { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")          // never return passwords
        .sort({ createdAt: -1 })      // newest first
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};


// @route  DELETE /api/admin/users/:id
// @desc   Permanently delete a user and their listings
// @access Admin only
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own admin account",
      });
    }

    // Also delete all listings posted by this user
    await Listing.deleteMany({ postedBy: user._id });

    // Delete the user
    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: `User "${user.name}" and their listings have been deleted`,
    });
  } catch (error) {
    next(error);
  }
};


// @route  PATCH /api/admin/users/:id/block
// @desc   Block a user (they can no longer log in)
// @access Admin only
const blockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Admin accounts cannot be blocked",
      });
    }

    if (user.isBlocked) {
      return res.status(400).json({
        success: false,
        message: "This user is already blocked",
      });
    }

    user.isBlocked = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User "${user.name}" has been blocked`,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};


// @route  PATCH /api/admin/users/:id/unblock
// @desc   Unblock a previously blocked user
// @access Admin only
const unblockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.isBlocked) {
      return res.status(400).json({
        success: false,
        message: "This user is not currently blocked",
      });
    }

    user.isBlocked = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User "${user.name}" has been unblocked`,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};


// ═══════════════════════════════════════════════════════════
//  SECTION 3 – LISTING MANAGEMENT
// ═══════════════════════════════════════════════════════════

// @route  GET /api/admin/listings
// @desc   Get all listings (with pagination and status filter)
// @access Admin only
const getAllListings = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;
    const status = req.query.status || ""; // filter by verificationStatus

    const filter = status ? { verificationStatus: status } : {};

    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .populate("postedBy", "name email") // show owner's name and email
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Listing.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        listings,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};


// @route  DELETE /api/admin/listings/:id
// @desc   Delete any listing (admin override)
// @access Admin only
const deleteListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    await Listing.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Listing has been deleted",
    });
  } catch (error) {
    next(error);
  }
};


// @route  PATCH /api/admin/listings/:id/verify
// @desc   Mark a listing as "verified" (admin approves it)
// @access Admin only
const verifyListing = async (req, res, next) => {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: "verified" },
      { new: true, runValidators: true }
    );

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    res.status(200).json({
      success: true,
      message: "Listing verified successfully",
      data: { listing },
    });
  } catch (error) {
    next(error);
  }
};


// @route  PATCH /api/admin/listings/:id/reject
// @desc   Reject a listing (admin rejects it)
// @access Admin only
const rejectListing = async (req, res, next) => {
  try {
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: "rejected" },
      { new: true, runValidators: true }
    );

    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    res.status(200).json({
      success: true,
      message: "Listing rejected",
      data: { listing },
    });
  } catch (error) {
    next(error);
  }
};


// ═══════════════════════════════════════════════════════════
//  SECTION 4 – REVIEW MANAGEMENT
// ═══════════════════════════════════════════════════════════

// @route  GET /api/admin/reviews
// @desc   Get all reviews across the platform
// @access Admin only
const getAllReviews = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find()
        .populate("reviewer", "name email")  // who wrote it
        .populate("listing",  "title")        // which listing
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};


// @route  DELETE /api/admin/reviews/:id
// @desc   Delete any review (admin override)
// @access Admin only
const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    await Review.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Review deleted",
    });
  } catch (error) {
    next(error);
  }
};


// ═══════════════════════════════════════════════════════════
//  SECTION 5 – REPORT MANAGEMENT
// ═══════════════════════════════════════════════════════════

// @route  POST /api/admin/reports
// @desc   File a new report (any logged-in user can do this)
// @access Private (logged-in users)
const createReport = async (req, res, next) => {
  try {
    const { targetType, targetListing, targetUser, reason, description } = req.body;

    // Validate: must have either a target listing or target user
    if (targetType === "listing" && !targetListing) {
      return res.status(400).json({
        success: false,
        message: "Please provide the listing ID to report",
      });
    }
    if (targetType === "user" && !targetUser) {
      return res.status(400).json({
        success: false,
        message: "Please provide the user ID to report",
      });
    }

    const report = await Report.create({
      reportedBy:    req.user._id,   // from JWT via protect middleware
      targetType,
      targetListing: targetType === "listing" ? targetListing : null,
      targetUser:    targetType === "user"    ? targetUser    : null,
      reason,
      description,
    });

    res.status(201).json({
      success: true,
      message: "Report submitted. Our team will review it shortly.",
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};


// @route  GET /api/admin/reports
// @desc   Get all reports (admin only)
// @access Admin only
const getAllReports = async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;
    const status = req.query.status || "pending"; // default: show pending

    const filter = status === "all" ? {} : { status };

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate("reportedBy",    "name email")
        .populate("targetListing", "title location")
        .populate("targetUser",    "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        reports,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
};


// @route  PATCH /api/admin/reports/:id/resolve
// @desc   Resolve a report (mark as handled)
// @access Admin only
const resolveReport = async (req, res, next) => {
  try {
    const { action } = req.body; // "resolved" or "dismissed"
    const validActions = ["resolved", "dismissed"];

    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'resolved' or 'dismissed'",
      });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: action, resolvedAt: new Date() },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    res.status(200).json({
      success: true,
      message: `Report marked as ${action}`,
      data: { report },
    });
  } catch (error) {
    next(error);
  }
};


// @route  DELETE /api/admin/reports/:id
// @desc   Delete a report permanently (admin only)
// @access Admin only
const deleteReport = async (req, res, next) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    res.status(200).json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};


// Export all controller functions
module.exports = {
  // Stats
  getDashboardStats,
  // Users
  getAllUsers,
  deleteUser,
  blockUser,
  unblockUser,
  // Listings
  getAllListings,
  deleteListing,
  verifyListing,
  rejectListing,
  // Reviews
  getAllReviews,
  deleteReview,
  // Reports
  createReport,
  getAllReports,
  resolveReport,
  deleteReport,
};
