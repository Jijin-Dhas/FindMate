// src/app.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Express App  (UPDATED v6.0: Admin Dashboard)
//
//  Changes from v5.0:
//  ✅ Added adminRoutes  mounted at /api/admin
//  ✅ Added reportRoutes mounted at /api/reports
// ═══════════════════════════════════════════════════════════

const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");

const authRoutes     = require("./routes/authRoutes");
const listingRoutes  = require("./routes/listingRoutes");
const healthRoutes   = require("./routes/healthRoutes");
const profileRoutes  = require("./routes/profileRoutes");
const matchingRoutes = require("./routes/matchingRoutes");
const chatRoutes     = require("./routes/chatRoutes");
const reviewRoutes   = require("./routes/reviewRoutes");
const supportRoutes  = require("./routes/supportRoutes");
const adminRoutes    = require("./routes/adminRoutes");   // ← ADMIN SYSTEM
const reportRoutes   = require("./routes/reportRoutes");  // ← USER REPORTS
const statsRoutes    = require("./routes/statsRoutes");   // ← PUBLIC STATS
const notFound       = require("./middleware/notFound");
const errorHandler   = require("./middleware/errorHandler");

const path = require("path");

const app = express();

// ─── SECURITY ─────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [];

app.use(cors({
  origin: function (origin, callback) {
    if (
      !origin ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      allowedOrigins.includes(origin)
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  methods:        ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials:    true,
}));

// ─── LOGGING ──────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ─── BODY PARSING ─────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── STATIC FILE SERVING ──────────────────────────────────
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"), {
    maxAge: "1d",
    fallthrough: false,
  })
);
// Serve frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// ─── ROUTES ───────────────────────────────────────────────
app.use("/api/health",    healthRoutes);
app.use("/api/auth",      authRoutes);
app.use("/api/listings",  listingRoutes);
app.use("/api/profile",   profileRoutes);
app.use("/api/matchings", matchingRoutes);
app.use("/api/chat",      chatRoutes);
app.use("/api/reviews",   reviewRoutes);
app.use("/api/support",   supportRoutes);
app.use("/api/admin",     adminRoutes);   // ← ADMIN SYSTEM (requires admin role)
app.use("/api/reports",   reportRoutes);  // ← USER REPORT SUBMISSION
app.use("/api/stats",    statsRoutes);   // ← PUBLIC STATS (login/register page)

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/home.html"));
});

// ─── ERROR HANDLING (must be LAST) ────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
