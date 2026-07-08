// frontend/js/config.js
// ============================================================
//  FindMate – Frontend Configuration
//
//  Automatically detects the API base URL from the browser's
//  current location so the app works on any host/port without
//  hardcoding "localhost:5000".
//
//  Usage: include this script BEFORE other JS files that need
//         API_BASE or SERVER_BASE.
//
//  Example:
//    <script src="./js/config.js"></script>
//    <script src="./js/listings.js"></script>
// ============================================================

// Derive the server origin from the page's own URL.
// • When served from Express:   http://localhost:5000  → uses that
// • When opened as a file:      file://…              → falls back to localhost:5000
const _origin = (location.protocol === "file:")
  ? "http://localhost:5000"
  : location.origin;

window.APP_CONFIG = {
  API_BASE:    _origin + "/api",
  SERVER_BASE: _origin,
  SOCKET_URL:  _origin,
};
