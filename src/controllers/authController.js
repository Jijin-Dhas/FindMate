// src/controllers/authController.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Auth Controller  (UPDATED v6.0: Admin Support)
//
//  Changes from v5.0:
//  ✅ login() now checks isBlocked — blocked users cannot log in
//  ✅ login() returns user.role so frontend knows if user is admin
// ═══════════════════════════════════════════════════════════

const jwt  = require("jsonwebtoken");
const User = require("../models/User");

// ── Helper: generate a JWT token ────────────────────────────
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

// ── Helper: send token + user data in response ──────────────
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);
  user.password = undefined; // never return password

  res.status(statusCode).json({
    success: true,
    token,
    data: { user },
  });
};

// ─────────────────────────────────────────────────────────
//  POST /api/auth/register
// ─────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, city, lookingFor } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const user = await User.create({ name, email, password, phone, city, lookingFor });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Select password (hidden by default) and role/isBlocked for checks
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // NEW v6.0: Blocked users cannot log in
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support.",
      });
    }

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // All checks passed — send token
    // The user object includes role: "user" | "admin" which
    // the frontend stores in localStorage to show/hide admin nav
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────
//  GET /api/auth/me
// ─────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

// (exports moved to bottom — see googleLogin addition below)


// ─────────────────────────────────────────────────────────────
//  POST /api/auth/google  (NEW – Firebase Google Sign-In)
//
//  What it does:
//  1. Receives { name, email, profileImage } from the frontend
//     after a successful Firebase Google popup sign-in.
//  2. Looks up the user by email in MongoDB.
//  3. If no account exists yet → creates one (password is a
//     random placeholder; Google users never use it).
//  4. Returns a real FindMate JWT, identical to the email/
//     password login response, so the rest of the app works
//     without any changes.
//
//  The frontend replaces the temporary 'firebase_google' token
//  in localStorage with this real JWT.
// ─────────────────────────────────────────────────────────────
const crypto = require('crypto');

const googleLogin = async (req, res, next) => {
  try {
    const { name, email, profileImage } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Google Sign-In did not return an email address.',
      });
    }

    // Find existing user or create a new one
    let user = await User.findOne({ email });

    if (!user) {
      // New user via Google — generate a secure random password
      // (they will never need to type it; Google is their auth)
      const randomPassword = crypto.randomBytes(32).toString('hex');

      user = await User.create({
        name:            name  || 'FindMate User',
        email,
        password:        randomPassword,
        profileImage:    profileImage || null,
        isVerified:      true,   // Google accounts are pre-verified
      });
    }

    // Blocked users cannot log in, even via Google
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.',
      });
    }

    // Issue a real FindMate JWT — identical shape to normal login
    sendTokenResponse(user, 200, res);

  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, googleLogin };
