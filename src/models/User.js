// src/models/User.js
// ═══════════════════════════════════════════════════════════
//  FindMate – User Model  (UPDATED v6.0: Admin Dashboard)
//
//  Changes from v5.0:
//  ✅ Added: role field ("user" | "admin") — default "user"
//  ✅ Added: isBlocked field — admin can block/unblock users
//
//  All original fields are UNCHANGED so existing data still works.
// ═══════════════════════════════════════════════════════════

const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ─── CORE AUTH FIELDS ────────────────────────────────
    name: {
      type:      String,
      required:  [true, "Name is required"],
      trim:      true,
      minlength: [2,  "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type:      String,
      required:  [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select:    false,
    },

    // ─── CONTACT & IDENTITY ──────────────────────────────
    phone:      { type: String, trim: true, default: null },
    age:        { type: Number, default: null, min: 16, max: 80 },
    gender:     { type: String, enum: ["male","female","other","prefer_not_to_say"], default: "prefer_not_to_say" },
    occupation: { type: String, trim: true, default: null, maxlength: 100 },
    city:       { type: String, trim: true, default: null },
    bio:        { type: String, default: "", maxlength: 300 },

    // ─── ROOMMATE PREFERENCES ─────────────────────────────
    lookingFor:        { type: String, enum: ["roommate","flatmate","either"], default: "either" },
    budget:            { min: { type: Number, default: 0 }, max: { type: Number, default: 50000 } },
    smokingPreference: { type: String, enum: ["smoker","non_smoker","okay_with_smoking","no_preference"], default: "no_preference" },
    foodPreference:    { type: String, enum: ["vegetarian","non_vegetarian","vegan","no_preference"], default: "no_preference" },

    // ─── ACCOUNT STATUS ───────────────────────────────────
    profileComplete: { type: Boolean, default: false },
    isVerified:      { type: Boolean, default: false },
    isActive:        { type: Boolean, default: true },

    // ─── ADMIN SYSTEM (NEW v6.0) ──────────────────────────
    // "user" = normal user (default), "admin" = full admin access
    role: {
      type:    String,
      enum:    ["user", "admin"],
      default: "user",
    },

    // Admin can block a user — blocked users cannot log in
    isBlocked: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true }
);


// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt    = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare plaintext password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
