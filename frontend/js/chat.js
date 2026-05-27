// frontend/js/chat.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Real-Time Chat Frontend
//
//  OVERVIEW OF HOW THIS WORKS:
//  ─────────────────────────────────────────────────────────
//  1. Page loads → check JWT token in localStorage
//  2. Connect to Socket.IO server with the token
//  3. Load conversation list via REST API
//  4. User clicks a conversation → load message history via REST
//  5. User types a message → emit "sendMessage" via Socket.IO
//  6. Server saves to MongoDB, emits back to both users
//  7. Browser receives "receiveMessage" event → render bubble
//
//  SOCKET.IO vs REST:
//  • REST API  = loading history, getting user list (one-off fetches)
//  • Socket.IO = sending & receiving messages in real-time
// ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────
const API_BASE    = "http://localhost:5000/api";
const SOCKET_URL  = "http://localhost:5000"; // Socket.IO server URL


// ─────────────────────────────────────────────────────────
//  AUTH — Read token and user from localStorage
//  These were stored when the user logged in via login.js
// ─────────────────────────────────────────────────────────
const token    = localStorage.getItem("findmate_token");
const userJson = localStorage.getItem("findmate_user");

let currentUser = null;
try {
  if (userJson) currentUser = JSON.parse(userJson);
} catch (e) { currentUser = null; }

// If not logged in → redirect to login page immediately
if (!token || !currentUser) {
  window.location.href = "./login.html";
}


// ─────────────────────────────────────────────────────────
//  STATE — variables that track what's currently happening
// ─────────────────────────────────────────────────────────
let socket           = null;   // Socket.IO connection
let activeReceiverId = null;   // ID of the user we're currently chatting with
let activeReceiverName = "";   // Their name (for the header)
let allUsers         = [];     // All users list (for New Chat modal)
let conversations    = [];     // Conversation list
let typingTimer      = null;   // Timer for "stop typing" emit


// ─────────────────────────────────────────────────────────
//  DOM REFERENCES — grab all the elements we'll manipulate
// ─────────────────────────────────────────────────────────
// Note: navbar elements (navLoginBtn, navUserPill etc.) are
// managed by navbar.js which is loaded before this script.

const convList       = document.getElementById("convList");
const convSearch     = document.getElementById("convSearch");
const convLoading    = document.getElementById("convLoading");

const chatPlaceholder= document.getElementById("chatPlaceholder");
const chatPanel      = document.getElementById("chatPanel");
const headerAvatar   = document.getElementById("headerAvatar");
const headerName     = document.getElementById("headerName");
const statusDot      = document.getElementById("statusDot");
const statusText     = document.getElementById("statusText");
const messagesArea   = document.getElementById("messagesArea");
const typingIndicator= document.getElementById("typingIndicator");
const composeInput   = document.getElementById("composeInput");
const btnSend        = document.getElementById("btnSend");

const btnNewChat     = document.getElementById("btnNewChat");
const newChatModal   = document.getElementById("newChatModal");
const btnCloseModal  = document.getElementById("btnCloseModal");
const userSearch     = document.getElementById("userSearch");
const userList       = document.getElementById("userList");

const chatSidebar    = document.getElementById("chatSidebar");
const chatMain       = document.getElementById("chatMain");
const btnBack        = document.getElementById("btnBack");


// ─────────────────────────────────────────────────────────
//  LOGOUT — override navbar.js version to also disconnect socket
// ─────────────────────────────────────────────────────────
window.logout = function () {
  if (socket) socket.disconnect();
  localStorage.removeItem("findmate_token");
  localStorage.removeItem("findmate_user");
  window.location.href = "./login.html";
};


// ═══════════════════════════════════════════════════════════
//  SOCKET.IO SETUP
//
//  WHAT IS io()?\n//  ─────────────────────────────────────────────────────────
//  io() creates a WebSocket connection from the browser to our
//  server. It's provided by the Socket.IO client library
//  (loaded from <script src="http://localhost:5000/socket.io/socket.io.js">)
//
//  The { auth: { token } } sends our JWT so the server can
//  authenticate us before processing any chat events.
// ═══════════════════════════════════════════════════════════
function initSocket() {
  // Connect to the Socket.IO server
  // The server verifies the token in its io.use() middleware
  socket = io(SOCKET_URL, {
    auth: { token: token },        // send JWT for authentication
    reconnectionAttempts: 5,       // retry up to 5 times if disconnected
    reconnectionDelay:    1000,    // wait 1 second between retries
  });

  // ── Socket.IO Events ─────────────────────────────────

  // CONNECTED successfully
  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
  });

  // CONNECTION ERROR (e.g., token expired)
  socket.on("connect_error", (err) => {
    console.error("Socket connect error:", err.message);
    // If auth failed → send user to login
    if (err.message.includes("AUTH_REQUIRED")) {
      showToast("Session expired. Please log in again.", "error");
      setTimeout(() => {
        localStorage.removeItem("findmate_token");
        localStorage.removeItem("findmate_user");
        window.location.href = "./login.html";
      }, 2000);
    }
  });

  // DISCONNECTED
  socket.on("disconnect", (reason) => {
    console.log("🔌 Socket disconnected:", reason);
    if (reason === "io server disconnect") {
      // Server actively disconnected us — try reconnect
      socket.connect();
    }
  });

  // ── RECEIVE A NEW MESSAGE ─────────────────────────────
  // Fired by server when someone sends US a message
  socket.on("receiveMessage", (msg) => {
    console.log("📩 receiveMessage:", msg);

    // If the message is part of the currently open conversation
    if (activeReceiverId && String(msg.senderId._id) === String(activeReceiverId)) {
      // Render it in the chat window
      appendMessage(msg, "received");
      scrollToBottom();

      // Mark as read immediately
      socket.emit("markRead", { senderId: activeReceiverId });
    } else {
      // Not in that chat → show notification toast
      const senderName = msg.senderId?.name || "Someone";
      showToast(`💬 New message from ${senderName}`, "info");
    }

    // Refresh the sidebar conversation list
    loadConversations();
  });

  // ── OWN MESSAGE CONFIRMED SENT ────────────────────────
  // Fired by server to confirm OUR message was saved
  socket.on("messageSent", (msg) => {
    console.log("✅ messageSent:", msg);
    // Render sent bubble in our chat window
    appendMessage(msg, "sent");
    scrollToBottom();
    // Refresh sidebar to update last message preview
    loadConversations();
  });

  // ── OTHER USER IS TYPING ──────────────────────────────
  socket.on("userTyping", (data) => {
    if (activeReceiverId && String(data.userId) === String(activeReceiverId)) {
      typingIndicator.classList.add("visible");
      scrollToBottom();
    }
  });

  // ── OTHER USER STOPPED TYPING ─────────────────────────
  socket.on("userStoppedTyping", (data) => {
    if (activeReceiverId && String(data.userId) === String(activeReceiverId)) {
      typingIndicator.classList.remove("visible");
    }
  });

  // ── ERROR FROM SERVER ─────────────────────────────────
  socket.on("error", (data) => {
    showToast(data.message || "Something went wrong", "error");
  });
}


// ═══════════════════════════════════════════════════════════
//  LOAD CONVERSATIONS (sidebar list)
// ═══════════════════════════════════════════════════════════
async function loadConversations() {
  try {
    const res  = await apiFetch("/chat/conversations");
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    conversations = data.data.conversations || [];
    renderConversations(conversations);

  } catch (err) {
    console.error("loadConversations error:", err);
    convList.innerHTML = `<div class="conv-empty"><p>Could not load conversations.</p></div>`;
  }
}

function renderConversations(list) {
  if (list.length === 0) {
    convList.innerHTML = `
      <div class="conv-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        <p>No conversations yet.<br>Click <strong>+</strong> to start one!</p>
      </div>`;
    return;
  }

  convList.innerHTML = list.map(conv => {
    const initial   = conv.userName.charAt(0).toUpperCase();
    const isActive  = String(conv.userId) === String(activeReceiverId);
    const timeStr   = formatConvTime(conv.lastMessageAt);
    const preview   = escHtml(conv.lastMessage || "");
    const badge     = conv.unreadCount > 0
      ? `<span class="unread-badge">${conv.unreadCount}</span>` : "";

    return `
      <div class="conv-item ${isActive ? "active" : ""}"
           data-userid="${escHtml(String(conv.userId))}"
           data-username="${escHtml(conv.userName)}"
           onclick="openConversation('${escHtml(String(conv.userId))}','${escHtml(conv.userName)}')">
        <div class="conv-avatar">${initial}</div>
        <div class="conv-info">
          <div class="conv-name">${escHtml(conv.userName)}</div>
          <div class="conv-preview">${preview}</div>
        </div>
        <div class="conv-meta">
          <span class="conv-time">${timeStr}</span>
          ${badge}
        </div>
      </div>`;
  }).join("");
}


// ═══════════════════════════════════════════════════════════
//  OPEN A CONVERSATION
//  Called when user clicks a conversation item or a user in the modal
// ═══════════════════════════════════════════════════════════
async function openConversation(receiverId, receiverName) {
  activeReceiverId   = receiverId;
  activeReceiverName = receiverName;

  // Update header
  headerName.textContent   = receiverName;
  headerAvatar.textContent = receiverName.charAt(0).toUpperCase();
  statusDot.className      = "status-dot";      // grey (no online detection yet)
  statusText.textContent   = "FindMate user";

  // Show the report button in the chat header (v7.0)
  const reportArea = document.getElementById("chatHeaderReport");
  if (reportArea) reportArea.style.display = "flex";

  // Show chat panel, hide placeholder
  chatPlaceholder.style.display = "none";
  chatPanel.style.display       = "flex";
  chatPanel.style.flexDirection = "column";
  chatPanel.style.height        = "100%";

  // On mobile: hide sidebar, show main
  chatSidebar.classList.add("hidden-mobile");
  chatMain.classList.remove("hidden-mobile");

  // Highlight the active conversation in sidebar
  document.querySelectorAll(".conv-item").forEach(el => {
    el.classList.toggle("active", el.dataset.userid === receiverId);
  });

  // Hide typing indicator
  typingIndicator.classList.remove("visible");

  // Show loading state in messages area
  messagesArea.innerHTML = `
    <div class="messages-loading">
      <div class="spinner"></div> Loading messages…
    </div>`;

  // Load message history
  await loadHistory(receiverId);

  // Tell server to mark messages from this user as read
  if (socket) {
    socket.emit("markRead", { senderId: receiverId });
  }

  // Focus the compose input
  composeInput.focus();
}


// ═══════════════════════════════════════════════════════════
//  LOAD MESSAGE HISTORY
// ═══════════════════════════════════════════════════════════
async function loadHistory(receiverId) {
  try {
    const res  = await apiFetch(`/chat/history/${receiverId}`);
    const data = await res.json();

    if (!data.success) throw new Error(data.message);

    const messages = data.data.messages || [];
    renderHistory(messages);
    scrollToBottom(false); // instant scroll (no animation) on load

  } catch (err) {
    console.error("loadHistory error:", err);
    messagesArea.innerHTML = `
      <div class="messages-empty">
        <div class="empty-icon">⚠️</div>
        <p>Could not load messages. Please try again.</p>
      </div>`;
  }
}

function renderHistory(messages) {
  if (messages.length === 0) {
    messagesArea.innerHTML = `
      <div class="messages-empty">
        <div class="empty-icon">👋</div>
        <p>No messages yet. Say hello!</p>
      </div>`;
    return;
  }

  messagesArea.innerHTML = "";

  let lastDate = null;

  messages.forEach(msg => {
    // Insert a date separator when the date changes
    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== lastDate) {
      messagesArea.appendChild(makeDateSeparator(msg.createdAt));
      lastDate = msgDate;
    }

    // Determine if I sent this or received it
    const isSent = String(msg.senderId._id || msg.senderId) === String(currentUser._id);
    appendMessage(msg, isSent ? "sent" : "received");
  });
}


// ═══════════════════════════════════════════════════════════
//  RENDER A SINGLE MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════
function appendMessage(msg, direction) {
  // Remove the empty-state placeholder if it's still there
  const emptyEl = messagesArea.querySelector(".messages-empty, .messages-loading");
  if (emptyEl) emptyEl.remove();

  const row = document.createElement("div");
  row.className = `message-row ${direction}`;

  // Format the time (e.g. "3:45 PM")
  const timeStr = formatMsgTime(msg.createdAt);

  // Show sender name above received messages
  const senderName = direction === "received"
    ? `<div class="message-sender-name">${escHtml(msg.senderId?.name || activeReceiverName)}</div>`
    : "";

  row.innerHTML = `
    ${senderName}
    <div class="bubble">${escHtml(msg.message)}</div>
    <div class="message-time">${timeStr}</div>
  `;

  messagesArea.appendChild(row);
}


// ─────────────────────────────────────────────────────────
//  SCROLL TO BOTTOM OF MESSAGES
// ─────────────────────────────────────────────────────────
function scrollToBottom(smooth = true) {
  if (!messagesArea) return;
  // requestAnimationFrame ensures the DOM has updated before we scroll
  requestAnimationFrame(() => {
    messagesArea.scrollTo({
      top:      messagesArea.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
  });
}


// ─────────────────────────────────────────────────────────
//  DATE SEPARATOR element
// ─────────────────────────────────────────────────────────
function makeDateSeparator(dateStr) {
  const div  = document.createElement("div");
  div.className = "date-separator";
  const d    = new Date(dateStr);
  const today= new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);

  let label;
  if (d.toDateString() === today.toDateString()) label = "Today";
  else if (d.toDateString() === yest.toDateString()) label = "Yesterday";
  else label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  div.textContent = label;
  return div;
}


// ═══════════════════════════════════════════════════════════
//  SEND MESSAGE
//  Primary path: emit via Socket.IO
//  The server saves to DB, then emits "messageSent" back to us
//  and "receiveMessage" to the receiver.
// ═══════════════════════════════════════════════════════════
function sendMessage() {
  const text = composeInput.value.trim();
  if (!text || !activeReceiverId || !socket) return;

  // Disable send button temporarily to prevent double-send
  btnSend.disabled = true;

  // Emit the message via Socket.IO
  socket.emit("sendMessage", {
    receiverId: activeReceiverId,
    message:    text,
  });

  // Clear the input immediately (optimistic UX)
  composeInput.value = "";
  composeInput.style.height = "auto"; // reset auto-resize

  // Re-enable after a short delay
  setTimeout(() => { btnSend.disabled = false; }, 300);

  // Stop the typing indicator
  if (socket) {
    socket.emit("stopTyping", { receiverId: activeReceiverId });
  }
  clearTimeout(typingTimer);
}


// ═══════════════════════════════════════════════════════════
//  LOAD ALL USERS (for New Chat modal)
// ═══════════════════════════════════════════════════════════
async function loadAllUsers() {
  try {
    const res  = await apiFetch("/chat/users");
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    allUsers = data.data.users || [];
    renderUserList(allUsers);
  } catch (err) {
    userList.innerHTML = `<div class="user-list-empty">Could not load users.</div>`;
  }
}

function renderUserList(users) {
  if (users.length === 0) {
    userList.innerHTML = `<div class="user-list-empty">No users found.</div>`;
    return;
  }

  userList.innerHTML = users.map(u => {
    const initial = u.name.charAt(0).toUpperCase();
    const sub     = [u.city, u.occupation].filter(Boolean).join(" · ") || "FindMate user";
    return `
      <div class="user-item"
           onclick="startChat('${escHtml(String(u._id))}','${escHtml(u.name)}')">
        <div class="user-item-avatar">${initial}</div>
        <div class="user-item-info">
          <div class="user-item-name">${escHtml(u.name)}</div>
          <div class="user-item-sub">${escHtml(sub)}</div>
        </div>
      </div>`;
  }).join("");
}

// Start a chat from the modal
function startChat(userId, userName) {
  closeNewChatModal();
  openConversation(userId, userName);
  // Reload conversations so this one appears in the sidebar
  setTimeout(loadConversations, 500);
}


// ─────────────────────────────────────────────────────────
//  MODAL OPEN / CLOSE
// ─────────────────────────────────────────────────────────
function openNewChatModal() {
  newChatModal.classList.remove("hidden");
  loadAllUsers();
  userSearch.value = "";
  userSearch.focus();
}

function closeNewChatModal() {
  newChatModal.classList.add("hidden");
}

// Close modal when clicking outside the box
newChatModal.addEventListener("click", (e) => {
  if (e.target === newChatModal) closeNewChatModal();
});


// ═══════════════════════════════════════════════════════════
//  COMPOSE INPUT — typing & send behaviour
// ═══════════════════════════════════════════════════════════

// Auto-resize textarea as user types
composeInput.addEventListener("input", () => {
  // Auto-grow up to 120px
  composeInput.style.height = "auto";
  composeInput.style.height = Math.min(composeInput.scrollHeight, 120) + "px";

  // Emit "typing" event via socket
  if (socket && activeReceiverId) {
    socket.emit("typing", { receiverId: activeReceiverId });

    // After 2 seconds of no typing → emit "stopTyping"
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit("stopTyping", { receiverId: activeReceiverId });
    }, 2000);
  }
});

// Send on Enter (Shift+Enter = new line)
composeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); // prevent newline
    sendMessage();
  }
});

// Send button click
btnSend.addEventListener("click", sendMessage);


// ─────────────────────────────────────────────────────────
//  SIDEBAR SEARCH — filter conversation list
// ─────────────────────────────────────────────────────────
convSearch.addEventListener("input", () => {
  const q = convSearch.value.toLowerCase().trim();
  const filtered = q
    ? conversations.filter(c => c.userName.toLowerCase().includes(q))
    : conversations;
  renderConversations(filtered);
});


// ─────────────────────────────────────────────────────────
//  USER SEARCH in modal
// ─────────────────────────────────────────────────────────
userSearch.addEventListener("input", () => {
  const q = userSearch.value.toLowerCase().trim();
  const filtered = q
    ? allUsers.filter(u => u.name.toLowerCase().includes(q))
    : allUsers;
  renderUserList(filtered);
});


// ─────────────────────────────────────────────────────────
//  MOBILE BACK BUTTON
// ─────────────────────────────────────────────────────────
btnBack.addEventListener("click", () => {
  chatSidebar.classList.remove("hidden-mobile");
  chatMain.classList.add("hidden-mobile");
  activeReceiverId = null;
  chatPanel.style.display      = "none";
  chatPlaceholder.style.display= "flex";
});


// ─────────────────────────────────────────────────────────
//  OTHER EVENT LISTENERS
// ─────────────────────────────────────────────────────────
btnNewChat.addEventListener("click", openNewChatModal);
btnCloseModal.addEventListener("click", closeNewChatModal);


// ═══════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

// Authenticated fetch helper — adds the Authorization header
async function apiFetch(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

// Format a timestamp as "3:45 PM"
function formatMsgTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour:   "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Format for sidebar: "3:45 PM" or "Yesterday" or "12 May"
function formatConvTime(dateStr) {
  if (!dateStr) return "";
  const d     = new Date(dateStr);
  const today = new Date();
  const yest  = new Date();
  yest.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// Escape HTML to prevent XSS
// NEVER inject raw user-provided text directly into innerHTML.
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

// Toast notification
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("out");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}


// ═══════════════════════════════════════════════════════════
//  CHECK IF WE SHOULD OPEN A SPECIFIC CONVERSATION ON LOAD
//  Other pages (e.g. listings.html) can link to:
//    chat.html?userId=64abc&userName=John
//  and the chat will open automatically.
// ═══════════════════════════════════════════════════════════
function checkUrlParams() {
  const params   = new URLSearchParams(window.location.search);
  const userId   = params.get("userId");
  const userName = params.get("userName");

  if (userId && userName) {
    // Clean the URL so the param doesn't persist on reload
    window.history.replaceState({}, "", "./chat.html");
    // Open the conversation
    openConversation(userId, decodeURIComponent(userName));
  }
}


// ═══════════════════════════════════════════════════════════
//  BOOT — runs when the page loads
// ═══════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // 1. Navbar handled by navbar.js (loaded before this script)

  // 2. Connect Socket.IO with JWT auth
  initSocket();

  // 3. Load the conversation sidebar
  loadConversations();

  // 4. Check if a specific chat should open (from URL params)
  checkUrlParams();
});


// ═══════════════════════════════════════════════════════════
//  REPORT USER FROM CHAT  (v7.0)
// ═══════════════════════════════════════════════════════════

/**
 * Opens the report modal pre-filled with the currently active
 * conversation partner. Called by the 🚩 button in the header.
 */
window.chatReportUser = function() {
  if (!activeReceiverId || !activeReceiverName) {
    if (typeof showReportToast === "function") {
      showReportToast("No conversation selected.", "warning");
    }
    return;
  }
  if (typeof openReportModal === "function") {
    openReportModal("user", activeReceiverId, activeReceiverName);
  }
};
