// src/middleware/upload.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Multer Image Upload Middleware
//
//  WHAT IS MULTER?
//  ───────────────
//  Multer is a Node.js middleware for handling multipart/form-data,
//  which is the encoding type used when uploading files via HTML forms.
//
//  Without multer, Express can only read text (JSON, URL-encoded).
//  Multer adds the ability to read files from the request body.
//
//  HOW IT WORKS (Step by Step):
//  ─────────────────────────────
//  1. Browser sends a POST request with Content-Type: multipart/form-data
//  2. Multer intercepts the request BEFORE your controller runs
//  3. It reads the file from the request stream
//  4. It validates the file type (we only allow images)
//  5. It checks the file size (we cap at 5MB)
//  6. It saves the file to the /uploads folder on disk
//  7. It attaches the file info to req.file so your controller can use it
//
//  WHAT req.file LOOKS LIKE AFTER UPLOAD:
//  ────────────────────────────────────────
//  {
//    fieldname:    'image',           // name attribute from <input>
//    originalname: 'my-room.jpg',     // original filename
//    encoding:     '7bit',
//    mimetype:     'image/jpeg',
//    destination:  'uploads/',        // folder where we saved it
//    filename:     'listing-1234.jpg',// new safe filename we generated
//    path:         'uploads/listing-1234.jpg', // full relative path
//    size:         204800             // file size in bytes
//  }
// ═══════════════════════════════════════════════════════════

const multer = require("multer");
const path   = require("path");   // Node built-in: handles file paths safely
const fs     = require("fs");     // Node built-in: file system operations


// ─────────────────────────────────────────────────────────
//  STEP 1: ENSURE THE UPLOADS FOLDER EXISTS
//  If it doesn't exist yet, create it automatically.
//  This prevents errors when the server first starts.
// ─────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "../../uploads");
//  __dirname = the folder this file is in (src/middleware/)
//  ../../     = go up two levels to the project root
//  uploads    = the uploads folder we want

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log("📁 Created /uploads directory");
}


// ─────────────────────────────────────────────────────────
//  STEP 2: DEFINE WHERE AND HOW TO SAVE FILES
//  diskStorage = save files to disk (vs memoryStorage = keep in RAM)
//  We use diskStorage because we want permanent files on the server.
// ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({

  // destination: decides WHICH FOLDER to save the file in
  destination: function (req, file, callback) {
    // callback(error, folder_path)
    // First argument is an error (null = no error)
    callback(null, UPLOAD_DIR);
  },

  // filename: decides WHAT TO NAME the saved file
  // We NEVER use the original filename for security:
  //   ❌ "../../etc/passwd.jpg" could be a path traversal attack
  //   ❌ "file with spaces.jpg" breaks URLs
  //   ✅ "listing-1703123456789-987654321.jpg" is safe and unique
  filename: function (req, file, callback) {
    // Get the file extension from the original name (.jpg, .png, etc.)
    const ext = path.extname(file.originalname).toLowerCase();

    // Build a unique safe filename:
    //   "listing-" prefix  → easy to identify
    //   Date.now()         → timestamp in milliseconds (unique per ms)
    //   Math.random()      → extra randomness to avoid collisions
    //   ext                → keep the correct extension
    const safeFilename = `listing-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    callback(null, safeFilename);
  },
});


// ─────────────────────────────────────────────────────────
//  STEP 3: FILE TYPE VALIDATION (fileFilter)
//  This function runs BEFORE the file is saved.
//  We check the MIME type to ensure only images are accepted.
//
//  ⚠️ SECURITY NOTE: Never trust file extensions alone.
//     A hacker could rename "virus.exe" to "virus.jpg".
//     MIME type check is stronger (though not 100% foolproof —
//     for production, also use a library like file-type to inspect
//     the actual file bytes).
// ─────────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = [
  "image/jpeg",   // .jpg / .jpeg
  "image/png",    // .png
  "image/webp",   // .webp (modern format, small file size)
  "image/gif",    // .gif (animated or static)
];

const fileFilter = function (req, file, callback) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    // callback(error, acceptFile)
    // null = no error, true = accept this file ✅
    callback(null, true);
  } else {
    // Reject the file and send back an error message
    // false = reject this file ❌
    callback(
      new Error("Only image files are allowed (JPG, PNG, WebP, GIF)"),
      false
    );
  }
};


// ─────────────────────────────────────────────────────────
//  STEP 4: CREATE THE MULTER INSTANCE
//  Combine storage, filter, and size limits into one object.
// ─────────────────────────────────────────────────────────
const upload = multer({
  storage:    storage,    // where to save (disk, in /uploads)
  fileFilter: fileFilter, // only allow images
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max (5 × 1024 × 1024 bytes)
    files:    1,               // only 1 file per request
  },
});


// ─────────────────────────────────────────────────────────
//  STEP 5: EXPORT READY-TO-USE MIDDLEWARES
//
//  upload.single("image") means:
//    - Read ONE file from the request
//    - The file must come from an input with name="image"
//    - After processing, the file info is in req.file
//
//  This is used in the route like:
//    router.post("/", protect, uploadImage, createListing)
// ─────────────────────────────────────────────────────────

// Middleware for uploading a single image (used on create & update routes)
const uploadImage = upload.single("image");

/**
 * A wrapper around uploadImage that catches Multer errors and
 * sends a friendly JSON error response instead of crashing.
 *
 * Usage in routes: router.post("/", protect, handleUpload, createListing)
 */
const handleUpload = (req, res, next) => {
  uploadImage(req, res, function (err) {
    if (!err) {
      // No error — file uploaded successfully (or no file sent, which is fine)
      return next();
    }

    // Multer-specific errors (file too big, wrong type, etc.)
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Image is too large. Maximum size is 5MB.",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          message: "You can only upload one image per listing.",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    }

    // Custom errors from our fileFilter (wrong file type)
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
  });
};


// ─────────────────────────────────────────────────────────
//  HELPER: Delete an uploaded image file from disk
//  Called when a listing is deleted or its image is replaced.
// ─────────────────────────────────────────────────────────
/**
 * Deletes an image file from the /uploads directory.
 * Silently ignores errors (e.g., file already deleted).
 *
 * @param {string} imagePath - The stored path, e.g. "uploads/listing-123.jpg"
 */
const deleteImageFile = (imagePath) => {
  if (!imagePath) return; // nothing to delete

  // Build the absolute path to the file
  // imagePath stored in DB looks like: "uploads/listing-123.jpg"
  // We need: "/home/user/project/uploads/listing-123.jpg"
  const absolutePath = path.join(__dirname, "../../", imagePath);

  // Check if file actually exists before trying to delete
  if (fs.existsSync(absolutePath)) {
    fs.unlink(absolutePath, (err) => {
      if (err) {
        // Log but don't crash — deleting old images is best-effort
        console.error("⚠️  Could not delete image file:", err.message);
      } else {
        console.log("🗑️  Deleted old image:", imagePath);
      }
    });
  }
};


module.exports = {
  handleUpload,       // middleware to use in routes
  deleteImageFile,    // helper to delete files from disk
  UPLOAD_DIR,         // exported for reference if needed
};
