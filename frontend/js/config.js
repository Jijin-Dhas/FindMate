// frontend/js/config.js

const isLocalhost =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";

window.APP_CONFIG = {
  API_BASE: isLocalhost
    ? "http://localhost:5000/api"
    : "https://findmate-1.onrender.com/api",

  SERVER_BASE: isLocalhost
    ? "http://localhost:5000"
    : "https://findmate-1.onrender.com",

  SOCKET_URL: isLocalhost
    ? "http://localhost:5000"
    : "https://findmate-1.onrender.com"
};