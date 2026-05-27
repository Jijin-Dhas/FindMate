// src/controllers/profileController.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Profile Controller
//
//  This file handles two things:
//  1. GET  /api/profile      → return the logged-in user's profile
//  2. PUT  /api/profile      → update the logged-in user's profile
//
//  Both routes are PROTECTED — the `protect` JWT middleware
//  runs first and puts the user object into req.user.
// ═══════════════════════════════════════════════════════════

const User       = require("../models/User");
const { sendSuccess, sendError } = require("../utils/apiResponse");


// ─────────────────────────────────────────────────────────
//  @route   GET /api/profile
//  @desc    Get the currently logged-in user's profile
//  @access  Private (requires Bearer token)
// ─────────────────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    // req.user is set by the protect middleware (src/middleware/auth.js)
    // We re-fetch the user from the database to always get the latest data.
    // The `-password` means "exclude the password field from the result".
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return sendError(res, "User not found", 404);
    }

    return sendSuccess(res, { user }, "Profile fetched successfully");

  } catch (error) {
    // Pass unexpected errors to Express's global error handler
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  @route   PUT /api/profile
//  @desc    Update the currently logged-in user's profile
//  @access  Private (requires Bearer token)
// ─────────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    // ── Step 1: Pick only the fields we allow users to update ──
    // This is called "whitelisting" — it prevents a user from
    // sneaking in fields like `isVerified: true` or `isActive: false`.
    const allowedFields = [
      "name",
      "phone",
      "age",
      "gender",
      "city",
      "occupation",
      "bio",
      "lookingFor",
      "smokingPreference",
      "foodPreference",
    ];

    // Build an object with only the allowed fields that were actually sent
    const updateData = {};
    allowedFields.forEach((field) => {
      // Only include the field if it was actually sent in the request body
      // (we use `hasOwnProperty` to allow sending empty strings intentionally)
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updateData[field] = req.body[field];
      }
    });

    // ── Step 2: Handle budget separately (it's a nested object) ──
    // Budget comes in as: { budget: { min: 5000, max: 15000 } }
    if (req.body.budget) {
      const { min, max } = req.body.budget;

      // Validate that min and max are actual numbers
      if (min !== undefined && (isNaN(min) || min < 0)) {
        return sendError(res, "Budget minimum must be a positive number");
      }
      if (max !== undefined && (isNaN(max) || max < 0)) {
        return sendError(res, "Budget maximum must be a positive number");
      }
      if (min !== undefined && max !== undefined && Number(min) > Number(max)) {
        return sendError(res, "Budget minimum cannot be greater than maximum");
      }

      updateData.budget = {};
      if (min !== undefined) updateData.budget.min = Number(min);
      if (max !== undefined) updateData.budget.max = Number(max);
    }

    // ── Step 3: Manual validation ──

    // Name must not be empty if provided
    if (updateData.name !== undefined) {
      updateData.name = updateData.name.trim();
      if (updateData.name.length < 2) {
        return sendError(res, "Name must be at least 2 characters");
      }
      if (updateData.name.length > 50) {
        return sendError(res, "Name cannot exceed 50 characters");
      }
    }

    // Age must be a number between 16 and 80
    if (updateData.age !== undefined && updateData.age !== null && updateData.age !== "") {
      const ageNum = Number(updateData.age);
      if (isNaN(ageNum) || ageNum < 16 || ageNum > 80) {
        return sendError(res, "Age must be a number between 16 and 80");
      }
      updateData.age = ageNum;
    }

    // Bio cannot exceed 300 characters
    if (updateData.bio !== undefined && updateData.bio.length > 300) {
      return sendError(res, "Bio cannot exceed 300 characters");
    }

    // ── Step 4: Mark profile as complete if key fields are filled ──
    // We consider a profile "complete" if user provided name, city, and bio.
    const currentUser = await User.findById(req.user._id);
    const mergedName  = updateData.name  || currentUser.name;
    const mergedCity  = updateData.city  || currentUser.city;
    const mergedBio   = updateData.bio   !== undefined ? updateData.bio : currentUser.bio;

    if (mergedName && mergedCity && mergedBio) {
      updateData.profileComplete = true;
    }

    // ── Step 5: Save to database ──
    // `new: true` → return the updated document (not the old one)
    // `runValidators: true` → run Mongoose schema validations on update
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },     // $set only changes the specified fields
      { new: true, runValidators: true }
    ).select("-password");      // never return the hashed password

    if (!updatedUser) {
      return sendError(res, "User not found", 404);
    }

    return sendSuccess(res, { user: updatedUser }, "Profile updated successfully");

  } catch (error) {
    // Handle Mongoose validation errors (e.g., invalid enum value)
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return sendError(res, messages.join(", "), 400);
    }
    next(error);
  }
};


module.exports = { getProfile, updateProfile };
