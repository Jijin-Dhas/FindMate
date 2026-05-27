// js/profile.js
// ============================================================
//  FindMate – Profile Page Logic
//
//  What this file does (in order):
//  1. Checks if user is logged in — redirects to login if not
//  2. Fetches the user's profile from the API on page load
//  3. Fills every form field with the fetched data (view mode)
//  4. "Edit Profile" button enables all fields (edit mode)
//  5. "Cancel" button reverts all fields back to original data
//  6. "Save Changes" submits the form to the API (PUT request)
//  7. Shows success / error messages to the user
//  8. Logout button clears token and redirects to login
// ============================================================


// ─────────────────────────────────────────────────────────
// SECTION 1: CONFIGURATION
// ─────────────────────────────────────────────────────────

const API_BASE       = 'http://localhost:5000/api';
const TOKEN_KEY      = 'findmate_token';
const USER_KEY       = 'findmate_user';
const LOGIN_PATH     = './login.html';
const DASHBOARD_PATH = './home.html';


// ─────────────────────────────────────────────────────────
// SECTION 2: AUTH GUARD
// If no token exists, send user back to login immediately.
// ─────────────────────────────────────────────────────────
const token = localStorage.getItem(TOKEN_KEY);
if (!token) {
  window.location.replace(LOGIN_PATH);
}


// ─────────────────────────────────────────────────────────
// SECTION 3: GET DOM ELEMENTS
// ─────────────────────────────────────────────────────────

const pageLoader     = document.getElementById('pageLoader');
const profileForm    = document.getElementById('profileForm');
const editToggleBtn  = document.getElementById('editToggleBtn');
const editToggleLbl  = document.getElementById('editToggleLabel');
const formActions    = document.getElementById('formActions');
const cancelBtn      = document.getElementById('cancelBtn');
const saveBtn        = document.getElementById('saveBtn');
const logoutBtn      = document.getElementById('logoutBtn');

const alertSuccess    = document.getElementById('alertSuccess');
const alertError      = document.getElementById('alertError');
const alertSuccessMsg = document.getElementById('alertSuccessMsg');
const alertErrorMsg   = document.getElementById('alertErrorMsg');

const allFields = profileForm.querySelectorAll('input, select, textarea');

const bioField  = document.getElementById('bio');
const bioCount  = document.getElementById('bioCount');

// Stores last successfully saved data so Cancel can revert
let originalData = null;


// ─────────────────────────────────────────────────────────
// SECTION 4: HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────

function showAlert(type, message) {
  alertSuccess.classList.remove('show');
  alertError.classList.remove('show');

  if (type === 'success') {
    alertSuccessMsg.textContent = message;
    alertSuccess.classList.add('show');
  } else {
    alertErrorMsg.textContent = message;
    alertError.classList.add('show');
  }

  setTimeout(() => {
    alertSuccess.classList.remove('show');
    alertError.classList.remove('show');
  }, 5000);
}

function hideAlerts() {
  alertSuccess.classList.remove('show');
  alertError.classList.remove('show');
}

function showLoader() { pageLoader.classList.remove('hidden'); }
function hideLoader() { pageLoader.classList.add('hidden'); }

function enableFields()  { allFields.forEach(f => { f.disabled = false; }); }
function disableFields() { allFields.forEach(f => { f.disabled = true;  }); }

function setSaveBtnLoading() { saveBtn.classList.add('loading');    saveBtn.disabled = true;  }
function resetSaveBtn()      { saveBtn.classList.remove('loading'); saveBtn.disabled = false; }

function setField(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = (value !== null && value !== undefined) ? value : '';
}

function setSelect(id, value) {
  const el = document.getElementById(id);
  if (!el || !value) return;
  el.value = value;
}

function setFieldError(groupId, message) {
  const group   = document.getElementById(groupId);
  const fieldId = groupId.replace('group-', '');
  const errorEl = document.getElementById('error-' + fieldId);
  if (group)   group.classList.add('has-error');
  if (errorEl) errorEl.textContent = message;
}

function clearAllErrors() {
  document.querySelectorAll('.field-group.has-error').forEach(g => g.classList.remove('has-error'));
  document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
}


// ─────────────────────────────────────────────────────────
// SECTION 5: FILL FORM WITH USER DATA
// ─────────────────────────────────────────────────────────

function fillForm(user) {
  setField('name',       user.name);
  setField('phone',      user.phone);
  setField('age',        user.age);
  setField('city',       user.city);
  setField('occupation', user.occupation);
  setField('bio',        user.bio);

  setSelect('gender',             user.gender);
  setSelect('lookingFor',         user.lookingFor);
  setSelect('smokingPreference',  user.smokingPreference);
  setSelect('foodPreference',     user.foodPreference);

  if (user.budget) {
    setField('budgetMin', user.budget.min);
    setField('budgetMax', user.budget.max);
  }

  updateBioCounter(user.bio || '');
  updateCompleteBadge(user.profileComplete);

  // ── Safety & Trust widget (v7.0) ────────────────────────
  // Render trust score ring below the page header
  try {
    const trustWidget = document.getElementById('profileTrustWidget');
    if (trustWidget && typeof renderTrustScoreWidget === 'function') {
      const score = computeUserTrustScore(user);
      trustWidget.innerHTML = renderTrustScoreWidget(score, 'Your Trust Score');
      trustWidget.style.display = 'block';
    }
    // Check if viewing someone else's profile (URL param ?userId=xxx)
    const urlUserId = new URLSearchParams(window.location.search).get('userId');
    const reportArea = document.getElementById('profileReportArea');
    if (reportArea && urlUserId && urlUserId !== user._id) {
      reportArea.style.display = 'block';
      window._profileViewedUserId   = urlUserId;
      window._profileViewedUserName = user.name || 'this user';
    }
  } catch (e) {
    // report.js may not be loaded — silently ignore
  }
}


// ─────────────────────────────────────────────────────────
// SECTION 6: FETCH PROFILE FROM API
// ─────────────────────────────────────────────────────────

async function loadProfile() {
  showLoader();
  hideAlerts();

  try {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
    });

    const data = await response.json();

    if (response.ok && data.data && data.data.user) {
      originalData = data.data.user;
      fillForm(originalData);

    } else if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.replace(LOGIN_PATH);

    } else {
      showAlert('error', data.message || 'Failed to load profile. Please refresh the page.');
    }

  } catch (networkError) {
    console.error('Failed to fetch profile:', networkError);
    showAlert('error', 'Cannot reach the server. Make sure the backend is running on port 5000.');
  } finally {
    hideLoader();
  }
}


// ─────────────────────────────────────────────────────────
// SECTION 7: FORM VALIDATION
// ─────────────────────────────────────────────────────────

function validateForm() {
  let isValid = true;
  clearAllErrors();

  const name      = document.getElementById('name').value.trim();
  const age       = document.getElementById('age').value;
  const bio       = document.getElementById('bio').value;
  const budgetMin = document.getElementById('budgetMin').value;
  const budgetMax = document.getElementById('budgetMax').value;

  if (!name) {
    setFieldError('group-name', 'Full name is required.');
    isValid = false;
  } else if (name.length < 2) {
    setFieldError('group-name', 'Name must be at least 2 characters.');
    isValid = false;
  }

  if (age !== '' && age !== null) {
    const ageNum = Number(age);
    if (isNaN(ageNum) || ageNum < 16 || ageNum > 80) {
      setFieldError('group-age', 'Age must be between 16 and 80.');
      isValid = false;
    }
  }

  if (bio.length > 300) {
    setFieldError('group-bio', 'Bio cannot exceed 300 characters.');
    isValid = false;
  }

  if (budgetMin !== '' && budgetMax !== '') {
    if (Number(budgetMin) > Number(budgetMax)) {
      const errorEl = document.getElementById('error-budget');
      if (errorEl) errorEl.textContent = 'Minimum budget cannot be greater than maximum.';
      isValid = false;
    }
  }

  return isValid;
}


// ─────────────────────────────────────────────────────────
// SECTION 8: SAVE PROFILE
// ─────────────────────────────────────────────────────────

profileForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  hideAlerts();

  if (!validateForm()) return;

  setSaveBtnLoading();

  const payload = {
    name:              document.getElementById('name').value.trim(),
    phone:             document.getElementById('phone').value.trim(),
    age:               document.getElementById('age').value || null,
    gender:            document.getElementById('gender').value,
    city:              document.getElementById('city').value.trim(),
    occupation:        document.getElementById('occupation').value.trim(),
    bio:               document.getElementById('bio').value.trim(),
    lookingFor:        document.getElementById('lookingFor').value,
    smokingPreference: document.getElementById('smokingPreference').value,
    foodPreference:    document.getElementById('foodPreference').value,
    budget: {
      min: document.getElementById('budgetMin').value || 0,
      max: document.getElementById('budgetMax').value || 50000,
    },
  };

  try {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.data && data.data.user) {
      originalData = data.data.user;

      // Keep localStorage in sync so dashboard shows updated name
      const storedUser = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
      storedUser.name  = data.data.user.name;
      localStorage.setItem(USER_KEY, JSON.stringify(storedUser));

      exitEditMode();
      showAlert('success', 'Profile saved successfully!');

    } else if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.replace(LOGIN_PATH);

    } else {
      resetSaveBtn();
      showAlert('error', data.message || 'Failed to save profile. Please try again.');
    }

  } catch (networkError) {
    console.error('Failed to save profile:', networkError);
    resetSaveBtn();
    showAlert('error', 'Cannot reach the server. Please check your connection.');
  }
});


// ─────────────────────────────────────────────────────────
// SECTION 9: EDIT / VIEW MODE SWITCHING
// ─────────────────────────────────────────────────────────

function enterEditMode() {
  enableFields();
  editToggleBtn.classList.add('editing');
  editToggleLbl.textContent = 'Viewing';
  formActions.classList.add('visible');
  hideAlerts();
}

function exitEditMode() {
  disableFields();
  editToggleBtn.classList.remove('editing');
  editToggleLbl.textContent = 'Edit Profile';
  formActions.classList.remove('visible');
  resetSaveBtn();
}

editToggleBtn.addEventListener('click', function () {
  const isEditing = editToggleBtn.classList.contains('editing');
  if (isEditing) {
    revertForm();
    exitEditMode();
  } else {
    enterEditMode();
  }
});

cancelBtn.addEventListener('click', function () {
  revertForm();
  exitEditMode();
  hideAlerts();
});

function revertForm() {
  if (originalData) fillForm(originalData);
  clearAllErrors();
}


// ─────────────────────────────────────────────────────────
// SECTION 10: BIO CHARACTER COUNTER
// ─────────────────────────────────────────────────────────

function updateBioCounter(value) {
  const len      = value.length;
  const charSpan = document.querySelector('.char-count');
  bioCount.textContent = len;

  if (charSpan) {
    charSpan.classList.remove('warning', 'danger');
    if (len >= 280)      charSpan.classList.add('danger');
    else if (len >= 240) charSpan.classList.add('warning');
  }
}

bioField.addEventListener('input', function () {
  updateBioCounter(this.value);
});


// ─────────────────────────────────────────────────────────
// SECTION 11: PROFILE COMPLETE BADGE
// ─────────────────────────────────────────────────────────

function updateCompleteBadge(isComplete) {
  document.querySelectorAll('.complete-badge, .incomplete-badge').forEach(b => b.remove());

  const title = document.querySelector('.page-title');
  if (!title) return;

  const badge       = document.createElement('span');
  badge.className   = isComplete ? 'complete-badge' : 'incomplete-badge';
  badge.textContent = isComplete ? 'Complete' : 'Incomplete';
  title.appendChild(badge);
}


// ─────────────────────────────────────────────────────────
// SECTION 12: LOGOUT
// ─────────────────────────────────────────────────────────
// Logout is handled by navbar.js via onclick="logout()".
// Keep this as a safety fallback for the old #logoutBtn id.
const legacyLogoutBtn = document.getElementById('logoutBtn');
if (legacyLogoutBtn) {
  legacyLogoutBtn.addEventListener('click', function () {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = LOGIN_PATH;
  });
}


// ─────────────────────────────────────────────────────────
// SECTION 13: INITIALISE — load profile on page ready
// ─────────────────────────────────────────────────────────
loadProfile();


// ═══════════════════════════════════════════════════════════
//  REPORT USER FROM PROFILE  (v7.0)
// ═══════════════════════════════════════════════════════════
window.profileReportUser = function() {
  const userId   = window._profileViewedUserId;
  const userName = window._profileViewedUserName || 'this user';
  if (!userId) {
    if (typeof showReportToast === 'function') {
      showReportToast('Cannot determine which user to report.', 'warning');
    }
    return;
  }
  if (typeof openReportModal === 'function') {
    openReportModal('user', userId, userName);
  }
};
