// src/middleware/auth.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Auth Middleware  (UPDATED v6.0: Admin Support)
//
//  Changes from v5.0:
//  ✅ Added: isAdmin middleware — only allows role:"admin"
//  ✅ Updated: protect — now also checks isBlocked status
//
//  HOW THEY WORK TOGETHER:
//  protect  → checks JWT is valid and user exists
//  isAdmin  → used AFTER protect, checks role === "admin"
//
//  Usage in routes:
//    router.get("/admin/users", protect, isAdmin, controller)
// ═══════════════════════════════════════════════════════════

const jwt  = require("jsonwebtoken");
const User = require("../models/User");

// ── protect ───────────────────────────────────────────────
// Verifies JWT token. Attaches req.user on success.
// Rejects if: no token, invalid token, user deleted, user blocked.
const protect = async (req, res, next) => {
  try {
    let token;

    // Tokens are sent as: "Authorization: Bearer <token>"
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please log in to continue.",
      });
    }

    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load user from database
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    // NEW v6.0: Blocked users cannot use the app
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support.",
      });
    }

    req.user = user; // attach user to request for use in controllers
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token. Please log in again.",
    });
  }
};


// ── isAdmin ───────────────────────────────────────────────
// Must be used AFTER protect.
// Checks that the logged-in user has role === "admin".
// Regular users get a 403 Forbidden response.
const isAdmin = (req, res, next) => {
  // req.user is set by the protect middleware above
  if (req.user && req.user.role === "admin") {
    return next(); // user is admin — continue
  }

  // Not an admin — deny access
  return res.status(403).json({
    success: false,
    message: "Access denied. Admin privileges required.",
  });
};


module.exports = { protect, isAdmin };
