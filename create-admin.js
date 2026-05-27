// create-admin.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Admin Account Creation Script  (NEW v6.0)
//
//  Run this ONCE to create the default admin account.
//
//  HOW TO RUN:
//    node create-admin.js
//
//  Make sure your .env file is configured and MongoDB is running
//  before running this script.
// ═══════════════════════════════════════════════════════════

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

// Load environment variables
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/findmate";

// ── Admin credentials (change these if you want) ────────────
const ADMIN_EMAIL    = "admin@findmate.com";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME     = "FindMate Admin";

async function createAdmin() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Import User model AFTER connecting
    const User = require("./src/models/User");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });

    if (existingAdmin) {
      // If account exists but isn't admin, upgrade it
      if (existingAdmin.role !== "admin") {
        existingAdmin.role = "admin";
        await existingAdmin.save();
        console.log(`✅ Upgraded existing account to admin: ${ADMIN_EMAIL}`);
      } else {
        console.log(`ℹ️  Admin account already exists: ${ADMIN_EMAIL}`);
        console.log("   No changes made.");
      }
    } else {
      // Create brand new admin account
      // Note: password hashing is handled by the User model's pre-save hook
      await User.create({
        name:     ADMIN_NAME,
        email:    ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role:     "admin",
      });

      console.log("✅ Admin account created successfully!");
      console.log("─────────────────────────────────────────");
      console.log(`   Email:    ${ADMIN_EMAIL}`);
      console.log(`   Password: ${ADMIN_PASSWORD}`);
      console.log(`   Role:     admin`);
      console.log("─────────────────────────────────────────");
      console.log("⚠️  Change the password after first login!");
    }

  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

createAdmin();
