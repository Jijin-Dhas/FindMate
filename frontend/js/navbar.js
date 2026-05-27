// frontend/js/navbar.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Shared Navbar Logic  (UPDATED v6.0: Admin Link)
//
//  Changes from v5.0:
//  ✅ Added: Admin Dashboard link — only visible to admin users
//
//  HOW TO USE:
//  Add <script src="./js/navbar.js"></script> before </body>
//  on every page. It auto-runs when the DOM is ready.
// ═══════════════════════════════════════════════════════════

(function () {
  "use strict";

  // ── Read auth state ──────────────────────────────────────
  const token    = localStorage.getItem("findmate_token");
  const userJson = localStorage.getItem("findmate_user");

  let currentUser = null;
  try {
    if (userJson) currentUser = JSON.parse(userJson);
  } catch (e) { currentUser = null; }

  const isLoggedIn = Boolean(token && currentUser);

  // ── Show/hide navbar auth elements ──────────────────────
  const navUserPill   = document.getElementById("navUserPill");
  const navUserName   = document.getElementById("navUserName");
  const navUserAvatar = document.getElementById("navUserAvatar");
  const navAddBtn     = document.getElementById("navAddBtn");
  const navLogoutBtn  = document.getElementById("navLogoutBtn");
  const navLoginBtn   = document.getElementById("navLoginBtn");

  // ── Admin link (NEW v6.0) ────────────────────────────────
  // This element should have id="navAdminBtn" in the HTML.
  // It's hidden by default (display:none in CSS).
  // Only shown if the logged-in user has role === "admin".
  const navAdminBtn = document.getElementById("navAdminBtn");

  if (isLoggedIn) {
    if (navLoginBtn)  navLoginBtn.style.display  = "none";
    if (navUserPill)  navUserPill.style.display  = "flex";
    if (navAddBtn)    navAddBtn.style.display    = "inline-flex";
    if (navLogoutBtn) navLogoutBtn.style.display = "inline-flex";

    if (currentUser && navUserName) {
      navUserName.textContent = currentUser.name.split(" ")[0];
    }
    if (currentUser && navUserAvatar) {
      navUserAvatar.textContent = (currentUser.name || "?").charAt(0).toUpperCase();
    }

    // Show admin link only if user is admin
    if (navAdminBtn && currentUser && currentUser.role === "admin") {
      navAdminBtn.style.display = "inline-flex";
    }
  } else {
    if (navLoginBtn)  navLoginBtn.style.display  = "inline-flex";
    if (navUserPill)  navUserPill.style.display  = "none";
    if (navAddBtn)    navAddBtn.style.display    = "none";
    if (navLogoutBtn) navLogoutBtn.style.display = "none";
    if (navAdminBtn)  navAdminBtn.style.display  = "none";
  }


  // ── Hamburger menu toggle (mobile) ──────────────────────
  const hamburger  = document.getElementById("navHamburger");
  const navbar     = document.querySelector(".navbar");
  const navOverlay = document.getElementById("navOverlay");

  if (hamburger && navbar) {
    hamburger.addEventListener("click", function () {
      navbar.classList.toggle("menu-open");
    });
  }

  if (navOverlay) {
    navOverlay.addEventListener("click", function () {
      if (navbar) navbar.classList.remove("menu-open");
    });
  }

  document.querySelectorAll(".navbar-links .nav-link").forEach(function (link) {
    link.addEventListener("click", function () {
      if (navbar) navbar.classList.remove("menu-open");
    });
  });


  // ── Global logout function ───────────────────────────────
  window.logout = function () {
    localStorage.removeItem("findmate_token");
    localStorage.removeItem("findmate_user");
    window.location.href = "./login.html";
  };

})();
