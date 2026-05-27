// src/controllers/supportController.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Support Controller  (NEW v5.0)
//
//  submitSupportRequest  → POST /api/support
//    Anyone (logged in or guest) can submit a ticket.
//    If logged in, req.user is attached by the optional-auth
//    middleware so we can link the ticket to their account.
//
//  getSupportRequests    → GET /api/support
//    Returns all tickets sorted by newest first.
//    (Admin use — in production you'd protect this route.)
// ═══════════════════════════════════════════════════════════

const Support = require("../models/Support");


// ─────────────────────────────────────────────────────────
//  @route   POST /api/support
//  @desc    Submit a new help / support request
//  @access  Public — logged-in OR guest users can submit
//
//  Expected request body (JSON):
//  {
//    "name":     "Priya Sharma",
//    "email":    "priya@example.com",
//    "category": "listing",
//    "message":  "I cannot upload a photo to my listing..."
//  }
// ─────────────────────────────────────────────────────────
const submitSupportRequest = async (req, res, next) => {
  try {
    const { name, email, category, message } = req.body;

    // ── 1. Manual field validation ────────────────────────
    // We do this explicitly so beginner-friendly error messages
    // appear instead of raw Mongoose validation errors.

    // Check all required fields are present
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email address is required",
      });
    }

    // Basic email format check (more thorough check is in the model)
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Please select a support category",
      });
    }

    if (!message || message.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: "Please describe your issue in at least 20 characters",
      });
    }

    if (message.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message is too long (max 2000 characters)",
      });
    }

    // ── 2. Build the ticket data ──────────────────────────
    const ticketData = {
      name:     name.trim(),
      email:    email.trim().toLowerCase(),
      category,
      message:  message.trim(),
      status:   "open",
    };

    // ── 3. Link to user account if logged in ─────────────
    // req.user is set by the optionalAuth middleware (if token provided).
    // If the user isn't logged in, req.user is undefined — that's fine.
    if (req.user) {
      ticketData.userId = req.user.id;
    }

    // ── 4. Save to MongoDB ────────────────────────────────
    const ticket = await Support.create(ticketData);

    // ── 5. Send success response ──────────────────────────
    // We return the ticket ID so the frontend can display it
    // as a reference number (e.g. "Ticket #64f3a2b1c3d4e5f6")
    res.status(201).json({
      success: true,
      message: "Your support request has been received. We'll get back to you within 24 hours.",
      data: {
        ticketId:  ticket._id,
        category:  ticket.category,
        status:    ticket.status,
        createdAt: ticket.createdAt,
      },
    });

  } catch (error) {
    // Pass to the global error handler (src/middleware/errorHandler.js)
    next(error);
  }
};


// ─────────────────────────────────────────────────────────
//  @route   GET /api/support
//  @desc    Get all support tickets (for admin/review)
//  @access  Public for now — protect in production!
//
//  Optional query params:
//    ?status=open           → filter by status
//    ?category=technical    → filter by category
//    ?page=1&limit=20       → paginate results
// ─────────────────────────────────────────────────────────
const getSupportRequests = async (req, res, next) => {
  try {
    // Build filter from query params
    const filter = {};
    if (req.query.status)   filter.status   = req.query.status;
    if (req.query.category) filter.category = req.query.category;

    // Pagination
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const tickets = await Support.find(filter)
      .populate("userId", "name email") // attach user info if available
      .sort({ createdAt: -1 })          // newest first
      .skip(skip)
      .limit(limit);

    const total = await Support.countDocuments(filter);

    res.status(200).json({
      success: true,
      count:   tickets.length,
      total,
      data:    { tickets },
    });

  } catch (error) {
    next(error);
  }
};


module.exports = {
  submitSupportRequest,
  getSupportRequests,
};
