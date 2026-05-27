// src/server.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Server Entry Point  (UPDATED: Socket.IO added)
//
//  Changes from original:
//  ✅ Wraps Express app in Node's http.createServer()
//  ✅ Creates Socket.IO server on the same port
//  ✅ Passes io to Express app so controllers can emit events
//  ✅ Calls initSocket() to register all chat event handlers
//
//  HOW SOCKET.IO SHARES PORT 5000 WITH EXPRESS:
//  ─────────────────────────────────────────────────────────
//  We give Socket.IO the same http.Server instance as Express.
//  The server detects HTTP vs WebSocket traffic automatically.
//  No extra port needed! Both run on port 5000.
// ═══════════════════════════════════════════════════════════

require("dotenv").config(); // Load .env FIRST

const http           = require("http");        // Node built-in
const { Server }     = require("socket.io");   // Socket.IO server class
const app            = require("./app");
const connectDB      = require("./config/db");
const { initSocket } = require("./socket/socketHandler");

const PORT     = process.env.PORT     || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Wrap Express in a raw HTTP server
    //    Socket.IO needs this — it can't attach directly to Express
    const httpServer = http.createServer(app);

    // 3. Create Socket.IO instance on the same HTTP server
    const io = new Server(httpServer, {
      cors: {
        // Allow all localhost origins — safe for development
        origin: function (origin, callback) {
          if (
            !origin ||
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
            /^file:\/\//.test(origin)
          ) {
            callback(null, true);
          } else {
            const allowed = process.env.ALLOWED_ORIGINS
              ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
              : [];
            allowed.includes(origin)
              ? callback(null, true)
              : callback(new Error("Not allowed by CORS: " + origin));
          }
        },
        methods:     ["GET", "POST"],
        credentials: true,
      },
      pingTimeout:  60000,
      pingInterval: 25000,
    });

    // 4. Share io with Express so controllers can emit events
    //    Usage: const io = req.app.get("io"); io.to(room).emit(...)
    app.set("io", io);

    // 5. Register all Socket.IO event listeners
    initSocket(io);

    // 6. Start listening (HTTP + WebSocket on same port)
    httpServer.listen(PORT, () => {
      console.log("");
      console.log("╔════════════════════════════════════════╗");
      console.log("║     FindMate API + Chat Server         ║");
      console.log("╠════════════════════════════════════════╣");
      console.log(`║  Status   : Running ✅                 ║`);
      console.log(`║  Port     : ${PORT}                      ║`);
      console.log(`║  Mode     : ${NODE_ENV.padEnd(15)}       ║`);
      console.log(`║  HTTP API : http://localhost:${PORT}      ║`);
      console.log(`║  Socket   : ws://localhost:${PORT}        ║`);
      console.log("╚════════════════════════════════════════╝");
      console.log("");
    });

    // ─── Graceful Shutdown ─────────────────────────────────
    const shutdown = (signal) => {
      console.log(`\n⚠️  ${signal} received. Shutting down...`);
      httpServer.close(() => {
        console.log("✅ Server closed.");
        process.exit(0);
      });
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));
    process.on("unhandledRejection", (err) => {
      console.error("❌ Unhandled Rejection:", err.message);
      httpServer.close(() => process.exit(1));
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
