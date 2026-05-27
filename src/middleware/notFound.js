// src/middleware/notFound.js
// ─────────────────────────────────────────────────────────
//  Catches any request to a route that doesn't exist.
//  Place this AFTER all routes in app.js so it only fires
//  when no route matched the request.
// ─────────────────────────────────────────────────────────

const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = notFound;
