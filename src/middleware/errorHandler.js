// src/middleware/errorHandler.js
// ─────────────────────────────────────────────────────────
//  Global Error Handler — catches ANY error passed via next(error)
//  from controllers or other middleware.
//
//  Express knows this is an error handler because it has
//  FOUR parameters: (err, req, res, next)
// ─────────────────────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  // Start with the error we received
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // ── Handle specific Mongoose/MongoDB errors ────────────

  // Mongoose: invalid ObjectId (e.g., /api/listings/not-a-valid-id)
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: "${err.value}" is not a valid ID`;
  }

  // Mongoose: duplicate key (e.g., registering with existing email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    statusCode = 400;
    message = `An account with this ${field} already exists`;
  }

  // Mongoose: validation errors (e.g., required field missing)
  if (err.name === "ValidationError") {
    statusCode = 400;
    // Combine all validation error messages into one string
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(". ");
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please log in again.";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Your session has expired. Please log in again.";
  }

  // ── Send consistent error response ────────────────────
  res.status(statusCode).json({
    success: false,
    message,
    // Only show the full error stack in development (never in production!)
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
