// frontend/js/add-listing.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Add Listing Page Script  (UPDATED v3.0: Image Upload)
//
//  KEY CHANGE FROM v2.0:
//  ─────────────────────
//  Previously we sent: JSON.stringify({ title: "...", ... })
//    Content-Type: application/json
//
//  Now we send: new FormData() with the image file attached
//    Content-Type: multipart/form-data  ← set AUTOMATICALLY by browser
//
//  WHY FORMDATA INSTEAD OF JSON?
//  ──────────────────────────────
//  JSON can only carry text. Files are binary data (bytes).
//  FormData is a special format that can carry BOTH text fields
//  and binary file data in the same request.
//
//  HOW FORMDATA WORKS:
//  ────────────────────
//  const fd = new FormData();
//  fd.append("title", "My Room");      // text field
//  fd.append("image", fileInput.files[0]); // binary file
//  fetch(url, { method: "POST", body: fd }) // browser sets Content-Type automatically
//
//  ⚠️ IMPORTANT: Do NOT set Content-Type header manually with FormData.
//     The browser adds it automatically with the correct "boundary" string.
//     If you set it manually, the server can't parse the request.
// ═══════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────
const API_BASE    = c;
const SERVER_BASE = window.APP_CONFIG.SERVER_BASE; // for building image URLs


// ─────────────────────────────────────────────────────────
//  AUTH CHECK
// ─────────────────────────────────────────────────────────
const token    = localStorage.getItem("findmate_token");
const userJson = localStorage.getItem("findmate_user");

if (!token) {
  window.location.replace("./login.html");
}

let currentUser = null;
try {
  currentUser = JSON.parse(userJson);
} catch (e) {
  localStorage.clear();
  window.location.replace("./login.html");
}


// ─────────────────────────────────────────────────────────
//  NAVBAR
// ─────────────────────────────────────────────────────────
const userPill   = document.getElementById("navUserPill");
const userAvatar = document.getElementById("navUserAvatar");
const userName   = document.getElementById("navUserName");
const logoutBtn  = document.getElementById("navLogoutBtn");

if (currentUser) {
  userPill.style.display  = "flex";
  logoutBtn.style.display = "inline-flex";
  userName.textContent    = currentUser.name.split(" ")[0];
  userAvatar.textContent  = currentUser.name.charAt(0).toUpperCase();
}

function logout() {
  localStorage.removeItem("findmate_token");
  localStorage.removeItem("findmate_user");
  window.location.href = "./login.html";
}


// ─────────────────────────────────────────────────────────
//  CHARACTER COUNTER FOR DESCRIPTION
// ─────────────────────────────────────────────────────────
const descTextarea = document.getElementById("description");
const descCount    = document.getElementById("descCount");

descTextarea.addEventListener("input", () => {
  const len = descTextarea.value.length;
  descCount.textContent = `${len} / 1000 characters`;
  descCount.style.color = len > 900 ? "var(--warning)" : "var(--text-light)";
});


// ═══════════════════════════════════════════════════════════
//  IMAGE UPLOAD PREVIEW SYSTEM
//  ──────────────────────────────────────────────────────────
//  This section handles everything BEFORE the form is submitted:
//  1. User clicks the zone → browser opens file picker
//  2. User picks a file   → we validate size/type client-side
//  3. We show a live preview using FileReader API
//  4. User can remove the image by clicking ×
//  5. Drag & drop support for convenience
// ═══════════════════════════════════════════════════════════

const uploadZone  = document.getElementById("uploadZone");
const imageInput  = document.getElementById("imageInput");
const previewImg  = document.getElementById("previewImg");
const removeBtn   = document.getElementById("removeImgBtn");
const fileInfo    = document.getElementById("fileInfo");
const fileName    = document.getElementById("fileName");
const fileSize    = document.getElementById("fileSize");

// Max file size: 5MB (same as backend limit)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5,242,880 bytes

// Allowed MIME types (same as backend)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Formats bytes into a human-readable string.
 * Example: formatBytes(204800) → "200 KB"
 */
function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Shows the image preview in the upload zone.
 * Uses the FileReader API to read the file as a data URL (base64).
 * This works LOCALLY — no server request needed just to show a preview.
 *
 * @param {File} file - The File object from the input
 */
function showPreview(file) {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    showToast("Only JPG, PNG, WebP, or GIF images are allowed.", "error");
    clearImageInput();
    return;
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    showToast(`Image is too large (${formatBytes(file.size)}). Max is 5MB.`, "error");
    clearImageInput();
    return;
  }

  // FileReader: reads the file locally and gives us a data: URL
  // we can use as the src of an <img> tag — no server upload yet!
  const reader = new FileReader();

  reader.onload = function (e) {
    // e.target.result = "data:image/jpeg;base64,/9j/4AAQ..." (very long string)
    previewImg.src = e.target.result;

    // Show the preview image, hide the placeholder
    uploadZone.classList.add("has-image");

    // Show file info bar
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileInfo.classList.add("visible");
  };

  // Start reading the file as a base64 data URL
  reader.readAsDataURL(file);
}

/**
 * Clears the selected image and resets the zone to its initial state.
 */
function clearImageInput() {
  // Clear the file input (can't set value directly, so we reset it)
  imageInput.value = "";

  // Hide preview, show placeholder
  previewImg.src = "";
  uploadZone.classList.remove("has-image");

  // Hide file info bar
  fileInfo.classList.remove("visible");
  fileName.textContent = "No file selected";
  fileSize.textContent = "";
}

// ── Event: File picked via the input ──
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (file) showPreview(file);
});

// ── Event: Remove button clicked ──
removeBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // prevent click from bubbling to the upload zone
  clearImageInput();
});

// ── Drag & Drop Support ──────────────────────────────────
// When user drags a file over the zone, we visually highlight it.
// When they drop it, we use the file from the drop event.

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault(); // required to allow the drop event to fire
  uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", (e) => {
  // Only remove if we actually left the zone (not just moved over a child)
  if (!uploadZone.contains(e.relatedTarget)) {
    uploadZone.classList.remove("drag-over");
  }
});

uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");

  // Get the dropped file
  const file = e.dataTransfer.files[0];
  if (!file) return;

  // Put the file into the input element so FormData can pick it up
  // We can't directly assign to input.files (it's read-only),
  // so we use a DataTransfer object to transfer the file.
  const dt = new DataTransfer();
  dt.items.add(file);
  imageInput.files = dt.files;

  showPreview(file);
});


// ─────────────────────────────────────────────────────────
//  FORM VALIDATION
// ─────────────────────────────────────────────────────────
function setError(groupId) {
  const group = document.getElementById(groupId);
  if (group) group.classList.add("has-error");
}

function clearError(groupId) {
  const group = document.getElementById(groupId);
  if (group) group.classList.remove("has-error");
}

function validateForm() {
  let isValid = true;

  ["fg-title","fg-description","fg-city","fg-rent","fg-roomType","fg-contactNumber"]
    .forEach(clearError);

  const title       = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const city        = document.getElementById("city").value.trim();
  const rent        = document.getElementById("rent").value;
  const roomType    = document.getElementById("roomType").value;
  const contact     = document.getElementById("contactNumber").value.trim();

  if (!title || title.length < 5)         { setError("fg-title");         isValid = false; }
  if (!description || description.length < 20) { setError("fg-description"); isValid = false; }
  if (!city)                              { setError("fg-city");          isValid = false; }
  if (!rent || Number(rent) < 0)          { setError("fg-rent");          isValid = false; }
  if (!roomType)                          { setError("fg-roomType");      isValid = false; }
  if (!contact)                           { setError("fg-contactNumber"); isValid = false; }

  return isValid;
}


// ─────────────────────────────────────────────────────────
//  BUILD FORMDATA PAYLOAD
//  ─────────────────────────────────────────────────────────
//  Previously we used JSON.stringify({...}).
//  Now we use FormData which can carry both text AND files.
//
//  IMPORTANT RULES FOR FORMDATA + NESTED OBJECTS:
//  ────────────────────────────────────────────────
//  FormData only handles flat key-value pairs.
//  For nested objects like location: { city: "Chennai" }
//  we use bracket notation: "location[city]"
//
//  Express with urlencoded parser reads "location[city]"
//  and reconstructs it as req.body.location.city = "Chennai"
// ─────────────────────────────────────────────────────────
function buildFormData() {
  const fd = new FormData();

  // ── Text fields ──
  fd.append("title",       document.getElementById("title").value.trim());
  fd.append("description", document.getElementById("description").value.trim());
  fd.append("roomType",    document.getElementById("roomType").value);
  fd.append("contactNumber", document.getElementById("contactNumber").value.trim());

  // ── Nested object: location ──
  // Bracket notation → Express reconstructs as location: { city, area }
  fd.append("location[city]", document.getElementById("city").value.trim());
  fd.append("location[area]", document.getElementById("area").value.trim());

  // ── Nested object: rent ──
  fd.append("rent[amount]",       document.getElementById("rent").value);
  fd.append("rent[isNegotiable]", document.getElementById("isNegotiable").checked);

  // ── Nested object: preferredTenant ──
  fd.append("preferredTenant[gender]", document.getElementById("genderPreference").value);

  // ── availableFrom (optional) ──
  const avail = document.getElementById("availableFrom").value;
  if (avail) fd.append("availableFrom", avail);

  // ── Amenities (array) ──
  // FormData supports multiple values for the same key
  const checked = document.querySelectorAll("input[name='amenities']:checked");
  checked.forEach(cb => fd.append("amenities", cb.value));

  // ── Image file ──
  // imageInput.files[0] is the File object the user selected.
  // If no file was selected, files[0] is undefined — that's fine,
  // we just don't append the image field and the backend skips it.
  const imgFile = imageInput.files[0];
  if (imgFile) {
    fd.append("image", imgFile);
    // "image" must match the fieldname in upload.single("image") on the backend
  }

  // ── Nearby Places (v4.0) ──────────────────────────────
  // Each nearby place row has 3 fields identified by data-index on the row.
  // We only include rows where BOTH name AND type are filled in.
  // arrayIndex (0, 1, 2…) is the sequential position sent to the backend;
  // it must be contiguous so Express reconstructs a proper array.
  const nearbyRows = document.querySelectorAll(".nearby-place-row");
  let arrayIndex = 0; // separate counter so skipped rows don't leave gaps

  nearbyRows.forEach((row) => {
    const idx  = row.dataset.index; // matches the id suffix: np-name-0, np-type-0 …
    const name = (document.getElementById(`np-name-${idx}`)?.value || "").trim();
    const type =  document.getElementById(`np-type-${idx}`)?.value || "";
    const dist = (document.getElementById(`np-dist-${idx}`)?.value || "").trim();

    // Skip incomplete rows (user left name or type blank)
    if (!name || !type) return;

    fd.append(`nearbyPlaces[${arrayIndex}][name]`,     name);
    fd.append(`nearbyPlaces[${arrayIndex}][type]`,     type);
    fd.append(`nearbyPlaces[${arrayIndex}][distance]`, dist);
    arrayIndex++;
  });

  // ── Google Map Embed Link (v4.0) ──────────────────────
  // Only append if the user actually typed something
  const mapLink = (document.getElementById("googleMapLink")?.value || "").trim();
  if (mapLink) {
    fd.append("googleMapLink", mapLink);
  }

  return fd;
}


// ─────────────────────────────────────────────────────────
//  ALERTS & TOAST
// ─────────────────────────────────────────────────────────
function showAlert(type, message) {
  const alertEl = document.getElementById(`alert${type}`);
  const msgEl   = document.getElementById(`alert${type}Msg`);
  if (!alertEl || !msgEl) return;
  msgEl.textContent     = message;
  alertEl.style.display = "flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => { alertEl.style.display = "none"; }, 6000);
}

function hideAlerts() {
  document.getElementById("alertSuccess").style.display = "none";
  document.getElementById("alertError").style.display   = "none";
}

function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.4s";
    setTimeout(() => toast.remove(), 400);
  }, duration);
}


// ─────────────────────────────────────────────────────────
//  FORM SUBMIT HANDLER
// ─────────────────────────────────────────────────────────
const form      = document.getElementById("addListingForm");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlerts();

  if (!validateForm()) {
    showToast("Please fix the highlighted fields.", "error");
    return;
  }

  submitBtn.classList.add("loading");
  submitBtn.disabled = true;

  try {
    // ── Build FormData (includes image file if selected) ──
    const formData = buildFormData();

    // ── Send to API ──────────────────────────────────────
    // KEY DIFFERENCE FROM v2.0:
    //   OLD: body: JSON.stringify(data), headers: { "Content-Type": "application/json" }
    //   NEW: body: formData   (NO Content-Type header — browser sets it automatically!)
    //
    // Why no Content-Type? FormData needs to include a "boundary" string in the header:
    //   Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryXXXXXX
    // The browser generates the correct boundary automatically.
    // If you manually set Content-Type: multipart/form-data (without boundary),
    // the server can't parse the request and everything breaks.
    const response = await fetch(`${API_BASE}/listings`, {
      method:  "POST",
      headers: {
        // Only JWT auth header — NO Content-Type (browser handles it)
        "Authorization": `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showAlert("Success", "Your listing is live! Redirecting to browse page…");
      showToast("Listing created successfully! 🎉", "success");

      setTimeout(() => {
        window.location.href = "./listings.html";
      }, 2000);

    } else {
      const errorMsg = data.message || "Failed to create listing. Please try again.";
      showAlert("Error", errorMsg);
      showToast(errorMsg, "error");
    }

  } catch (error) {
    console.error("Create listing error:", error);
    showAlert("Error", "Could not connect to the server. Is it running?");
    showToast("Network error. Please check your connection.", "error");

  } finally {
    submitBtn.classList.remove("loading");
    submitBtn.disabled = false;
  }
});


// ─────────────────────────────────────────────────────────
//  REAL-TIME FIELD VALIDATION
// ─────────────────────────────────────────────────────────
const fieldsToWatch = [
  { id: "title",         groupId: "fg-title"         },
  { id: "description",   groupId: "fg-description"   },
  { id: "city",          groupId: "fg-city"           },
  { id: "rent",          groupId: "fg-rent"           },
  { id: "roomType",      groupId: "fg-roomType"       },
  { id: "contactNumber", groupId: "fg-contactNumber"  },
];

fieldsToWatch.forEach(({ id, groupId }) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input",  () => clearError(groupId));
    el.addEventListener("change", () => clearError(groupId));
  }
});


// ═══════════════════════════════════════════════════════════
//  NEARBY LOCATION FINDER — v4.0 additions
// ═══════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────
//  NEARBY PLACES: dynamic row management
//  ─────────────────────────────────────────────────────────
//  Each nearby place has 3 fields: name, type, distance.
//  We track how many rows exist with nearbyRowCount.
//  When "Add another place" is clicked, we add a new HTML
//  row and update the name attributes with the new index.
//  When × is clicked, we remove that row entirely.
// ─────────────────────────────────────────────────────────

// Starts at 1 because Row 0 is already in the HTML
let nearbyRowCount = 1;

// Maximum allowed rows (keeps things manageable)
const MAX_NEARBY_ROWS = 10;

/**
 * Adds a new nearby place row to the form.
 * Called when the user clicks "+ Add another place".
 */
function addNearbyRow() {
  // Don't allow more than MAX_NEARBY_ROWS
  if (nearbyRowCount >= MAX_NEARBY_ROWS) {
    showToast(`You can add at most ${MAX_NEARBY_ROWS} nearby places.`, "error");
    return;
  }

  const index     = nearbyRowCount; // current index for this new row
  const container = document.getElementById("nearbyPlacesContainer");

  // Build the HTML for one row
  // We use bracket notation for the name attributes:
  //   nearbyPlaces[1][name], nearbyPlaces[1][type], nearbyPlaces[1][distance]
  // This is how Express reconstructs nested arrays from FormData.
  const rowHtml = `
    <div class="nearby-place-row" data-index="${index}">
      <div class="nearby-place-fields">

        <!-- Place Name -->
        <div class="field-group" style="flex:2;">
          <label class="field-label" for="np-name-${index}">Place Name</label>
          <input
            type="text"
            id="np-name-${index}"
            name="nearbyPlaces[${index}][name]"
            class="form-input"
            placeholder="e.g. City Hospital, ABC College"
            maxlength="100"
          />
        </div>

        <!-- Place Type -->
        <div class="field-group" style="flex:1.5;">
          <label class="field-label" for="np-type-${index}">Type</label>
          <select id="np-type-${index}" name="nearbyPlaces[${index}][type]" class="form-select">
            <option value="">Select type</option>
            <option value="college">🎓 College</option>
            <option value="hospital">🏥 Hospital</option>
            <option value="bus_stop">🚌 Bus Stop</option>
            <option value="supermarket">🛒 Supermarket</option>
            <option value="restaurant">🍽️ Restaurant</option>
          </select>
        </div>

        <!-- Distance -->
        <div class="field-group" style="flex:1;">
          <label class="field-label" for="np-dist-${index}">Distance</label>
          <input
            type="text"
            id="np-dist-${index}"
            name="nearbyPlaces[${index}][distance]"
            class="form-input"
            placeholder="e.g. 500 m"
            maxlength="50"
          />
        </div>

        <!-- Remove button (visible for all rows except the first) -->
        <button
          type="button"
          class="nearby-remove-btn"
          onclick="removeNearbyRow(this)"
          title="Remove this place"
        >×</button>

      </div>
    </div>`;

  // Insert the new row HTML at the end of the container
  container.insertAdjacentHTML("beforeend", rowHtml);

  // Increment the counter for the next row
  nearbyRowCount++;

  // Hide the Add button if we've reached the max
  if (nearbyRowCount >= MAX_NEARBY_ROWS) {
    document.getElementById("addNearbyBtn").style.display = "none";
  }
}

/**
 * Removes a nearby place row when the × button is clicked.
 *
 * @param {HTMLButtonElement} btn — the × button that was clicked
 */
function removeNearbyRow(btn) {
  // btn is inside .nearby-place-fields inside .nearby-place-row
  // We go up to the row element and remove it
  const row = btn.closest(".nearby-place-row");
  if (row) {
    row.remove();
    nearbyRowCount--;

    // Show the Add button again if we're below the max
    if (nearbyRowCount < MAX_NEARBY_ROWS) {
      document.getElementById("addNearbyBtn").style.display = "inline-flex";
    }
  }
}


// ─────────────────────────────────────────────────────────
//  GOOGLE MAP EMBED LINK: live preview
//  ─────────────────────────────────────────────────────────
//  When the user pastes a Google Maps embed URL, we show
//  a live preview of the map inside an <iframe>.
//  This helps them confirm they pasted the right link.
// ─────────────────────────────────────────────────────────

const mapLinkInput  = document.getElementById("googleMapLink");
const mapPreviewWrap = document.getElementById("mapPreviewWrap");
const mapPreviewFrame = document.getElementById("mapPreview");

if (mapLinkInput) {
  mapLinkInput.addEventListener("input", function () {
    const url = this.value.trim();

    // Show preview only if URL looks like a Google Maps embed URL
    if (
      url.startsWith("https://www.google.com/maps/") ||
      url.startsWith("https://maps.google.com/")
    ) {
      // Set the iframe src to the pasted URL to display the map
      mapPreviewFrame.src   = url;
      mapPreviewWrap.style.display = "block";
    } else {
      // Hide preview if URL is cleared or invalid
      mapPreviewFrame.src   = "";
      mapPreviewWrap.style.display = "none";
    }
  });
}




