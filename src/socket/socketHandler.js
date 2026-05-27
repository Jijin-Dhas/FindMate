// src/socket/socketHandler.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Socket.IO Real-Time Chat Handler
//
//  WHAT IS SOCKET.IO?
//  ─────────────────────────────────────────────────────────
//  Normal HTTP requests are "ask → answer" (one-way trigger).
//  Socket.IO creates a PERSISTENT two-way connection, so the
//  server can PUSH data to the browser instantly — no polling.
//
//  HOW IT WORKS IN THIS FILE:
//  ─────────────────────────────────────────────────────────
//  1. User opens chat.html → browser connects via Socket.IO
//  2. Browser sends "authenticate" event with their JWT token
//  3. Server verifies token → joins user to their private "room"
//     (a room named by their user ID, e.g. "room_64abc123")
//  4. When user sends a message → "sendMessage" event fires
//  5. Server saves message to MongoDB
//  6. Server emits "receiveMessage" to the RECEIVER's room instantly
//
//  SECURITY:
//  Every socket connection is authenticated with JWT before
//  the user can send/receive any messages.
// ═══════════════════════════════════════════════════════════

const jwt     = require("jsonwebtoken");
const User    = require("../models/User");
const Message = require("../models/Message");

/**
 * initSocket — attaches Socket.IO event handlers to the server.
 *
 * @param {import("socket.io").Server} io — the Socket.IO server instance
 *
 * USAGE (in server.js):
 *   const { initSocket } = require("./socket/socketHandler");
 *   initSocket(io);
 */
function initSocket(io) {

  // ── Middleware: authenticate EVERY socket connection ─────
  //
  // Before ANY event is processed, we verify the user's JWT.
  // If invalid → the connection is rejected immediately.
  //
  // The token is sent from the frontend as:
  //   socket = io("http://localhost:5000", { auth: { token: "Bearer eyJ..." } })
  //
  io.use(async (socket, next) => {
    try {
      // Extract token from socket handshake auth data
      const rawToken = socket.handshake.auth?.token || "";

      // Remove "Bearer " prefix if present
      const token = rawToken.startsWith("Bearer ")
        ? rawToken.slice(7)
        : rawToken;

      if (!token) {
        return next(new Error("AUTH_REQUIRED: No token provided"));
      }

      // Verify JWT with our secret key
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Load the full user from DB
      const user = await User.findById(decoded.id).select("_id name email");
      if (!user) {
        return next(new Error("AUTH_REQUIRED: User not found"));
      }

      // ✅ Attach user to socket object — available in all events
      socket.user = user;
      next(); // allow connection

    } catch (err) {
      // JWT expired, tampered, etc.
      next(new Error("AUTH_REQUIRED: Invalid token"));
    }
  });


  // ── Connection Handler ────────────────────────────────────
  // Fires once for every successfully authenticated socket
  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`🔌 Socket connected: ${user.name} (${user._id})`);

    // ── JOIN personal room ────────────────────────────────
    // Each user joins a room named after their own ID.
    // When we want to send a message to User X, we emit to room X.
    // This way messages are private — only User X gets them.
    const myRoom = String(user._id);
    socket.join(myRoom);
    console.log(`   ↳ Joined room: ${myRoom}`);


    // ── EVENT: sendMessage ────────────────────────────────
    //
    // Fired by the frontend when the user clicks "Send".
    // Payload:  { receiverId: "...", message: "Hello!" }
    //
    socket.on("sendMessage", async (data) => {
      try {
        const { receiverId, message } = data || {};

        // ── Validate input ────────────────────────────────
        if (!receiverId || !message) {
          socket.emit("error", { message: "receiverId and message are required" });
          return;
        }

        const trimmed = String(message).trim();
        if (!trimmed) {
          socket.emit("error", { message: "Message cannot be empty" });
          return;
        }
        if (trimmed.length > 2000) {
          socket.emit("error", { message: "Message too long (max 2000 chars)" });
          return;
        }

        // Can't message yourself
        if (String(user._id) === String(receiverId)) {
          socket.emit("error", { message: "Cannot message yourself" });
          return;
        }

        // Check receiver exists
        const receiver = await User.findById(receiverId).select("_id name");
        if (!receiver) {
          socket.emit("error", { message: "Receiver not found" });
          return;
        }

        // ── Save message to MongoDB ───────────────────────
        const newMsg = await Message.create({
          senderId:   user._id,
          receiverId: receiverId,
          message:    trimmed,
        });

        // Build the payload to send back (include sender name etc.)
        const payload = {
          _id:        newMsg._id,
          senderId:   { _id: user._id, name: user.name },
          receiverId: { _id: receiver._id, name: receiver.name },
          message:    newMsg.message,
          isRead:     newMsg.isRead,
          createdAt:  newMsg.createdAt,
        };

        // ── Emit to RECEIVER's room (real-time delivery) ──
        // If receiver is online, their socket is in this room
        io.to(String(receiverId)).emit("receiveMessage", payload);

        // ── Confirm delivery back to SENDER ──────────────
        // So the sender sees their own message appear instantly
        socket.emit("messageSent", payload);

        console.log(`   💬 ${user.name} → ${receiver.name}: "${trimmed.substring(0, 30)}..."`);

      } catch (err) {
        console.error("Socket sendMessage error:", err.message);
        socket.emit("error", { message: "Failed to send message. Please try again." });
      }
    });


    // ── EVENT: markRead ───────────────────────────────────
    // Fired when user opens a conversation.
    // Marks all messages FROM the other user as read.
    // Payload: { senderId: "..." }
    //
    socket.on("markRead", async (data) => {
      try {
        const { senderId } = data || {};
        if (!senderId) return;

        await Message.updateMany(
          { senderId: senderId, receiverId: user._id, isRead: false },
          { isRead: true }
        );

        // Notify the sender that their messages were read
        io.to(String(senderId)).emit("messagesRead", {
          by:   String(user._id),
          from: String(senderId),
        });
      } catch (err) {
        console.error("Socket markRead error:", err.message);
      }
    });


    // ── EVENT: typing ─────────────────────────────────────
    // Fired when user starts typing in the input box.
    // Payload: { receiverId: "..." }
    //
    socket.on("typing", (data) => {
      const { receiverId } = data || {};
      if (!receiverId) return;

      // Tell the receiver that this user is typing
      io.to(String(receiverId)).emit("userTyping", {
        userId: String(user._id),
        name:   user.name,
      });
    });


    // ── EVENT: stopTyping ─────────────────────────────────
    // Fired when user stops typing (input blur / no keystrokes).
    //
    socket.on("stopTyping", (data) => {
      const { receiverId } = data || {};
      if (!receiverId) return;

      io.to(String(receiverId)).emit("userStoppedTyping", {
        userId: String(user._id),
      });
    });


    // ── EVENT: disconnect ─────────────────────────────────
    // Fires automatically when socket connection closes
    // (tab closed, network lost, etc.)
    //
    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${user.name} — ${reason}`);
    });

  }); // end io.on("connection")

} // end initSocket


module.exports = { initSocket };
