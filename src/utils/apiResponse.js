// src/utils/apiResponse.js
// ─────────────────────────────────────────────────────────
//  Helper functions to send consistent API responses.
//  Instead of writing res.status(200).json({...}) every time,
//  you can just call sendSuccess(res, data) or sendError(res, msg).
// ─────────────────────────────────────────────────────────

/**
 * Send a successful response
 * @param {Object} res - Express response object
 * @param {*} data - The data to send back
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data = {}, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 */
const sendError = (res, message = "Something went wrong", statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = { sendSuccess, sendError };
