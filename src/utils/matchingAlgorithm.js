// src/utils/matchingAlgorithm.js
// ═══════════════════════════════════════════════════════════
//  FindMate – Smart Roommate Matching Algorithm
//
//  PURPOSE:
//  This file calculates HOW WELL a listing matches a user's
//  preferences. It returns a score from 0 to 100.
//
//  HOW IT WORKS (Beginner-Friendly Explanation):
//  ─────────────────────────────────────────────
//  Imagine you're rating 6 different things about a listing:
//    1. City          → Does the listing city match your city?
//    2. Budget        → Is the rent within your budget range?
//    3. Gender        → Does the listing accept your gender?
//    4. Smoking       → Does the smoking preference match?
//    5. Food          → Does the food preference match?
//    6. Occupation    → Does it prefer your occupation type?
//
//  Each category has a WEIGHT (importance):
//    - City   = 30 points  (most important — must be same city)
//    - Budget = 25 points  (very important — must be affordable)
//    - Gender = 20 points  (important — safety/comfort)
//    - Smoking= 10 points  (medium — lifestyle)
//    - Food   =  8 points  (medium — lifestyle)
//    - Occupation = 7 points (lower — nice to have)
//                  ────────
//    TOTAL   = 100 points  (100%)
//
//  Each category can earn:
//    - FULL points  → exact match
//    - PARTIAL pts  → partial/flexible match
//    - ZERO points  → incompatible
// ═══════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────
//  WEIGHTS — total must equal 100
//  Adjust these numbers to change how important each factor is
// ─────────────────────────────────────────────────────────
const WEIGHTS = {
  city:        30,   // Same city = top priority
  budget:      25,   // Rent within budget = very important
  gender:      20,   // Gender preference = safety concern
  smoking:     10,   // Smoking habits = lifestyle match
  food:         8,   // Food preference = daily life harmony
  occupation:   7,   // Occupation type = working hours alignment
};

// TOTAL = 100 (30+25+20+10+8+7)


// ─────────────────────────────────────────────────────────
//  HELPER: normalise a string for comparison
//  Removes spaces, lowercases — so "Chennai" matches "chennai"
// ─────────────────────────────────────────────────────────
function normalise(str) {
  if (!str) return "";
  return String(str).toLowerCase().trim();
}


// ─────────────────────────────────────────────────────────
//  SCORE 1: CITY
//  Full score  → user's city matches listing's city exactly
//  Zero score  → cities are different
//
//  Why 30 points? You can't commute from Mumbai to Delhi!
//  City mismatch means the listing is basically useless.
// ─────────────────────────────────────────────────────────
function scoreCityMatch(userCity, listingCity) {
  if (!userCity || !listingCity) return 0;  // missing data = 0

  const isMatch = normalise(userCity) === normalise(listingCity);
  return isMatch ? WEIGHTS.city : 0;
  // No partial score here — either it's the same city or it's not
}


// ─────────────────────────────────────────────────────────
//  SCORE 2: BUDGET
//  Full score  → rent is comfortably within user's budget
//  Partial     → rent is slightly over budget (up to 20% over)
//  Zero        → rent is way over budget, OR no budget data
//
//  Example:
//    User budget: ₹8000 – ₹15000
//    Listing rent: ₹12000  → FULL score (within range)
//    Listing rent: ₹17000  → PARTIAL (13% over max, within 20%)
//    Listing rent: ₹25000  → ZERO (too expensive)
// ─────────────────────────────────────────────────────────
function scoreBudgetMatch(userBudget, listingRentAmount) {
  // Guard: if any value is missing, return 0
  if (!userBudget || listingRentAmount == null) return 0;

  const min  = Number(userBudget.min) || 0;
  const max  = Number(userBudget.max) || Infinity;
  const rent = Number(listingRentAmount);

  if (isNaN(rent)) return 0;

  if (rent >= min && rent <= max) {
    // Rent is perfectly within budget range → FULL score
    return WEIGHTS.budget;
  }

  // Rent is slightly above max budget (up to 20% over)
  const overBudgetLimit = max * 1.20; // 20% tolerance
  if (rent > max && rent <= overBudgetLimit) {
    // Partial score: the closer to max, the higher the score
    // Formula: how far over budget are we? (0% to 20%)
    const overPercent = (rent - max) / max;  // e.g. 0.10 = 10% over
    const partialMultiplier = 1 - (overPercent / 0.20); // 0 to 1 scale
    return Math.round(WEIGHTS.budget * partialMultiplier * 0.5);
    // Maximum partial is 50% of the budget weight
  }

  // Below min budget: possible scam or wrong category? Give partial
  if (rent < min) {
    return Math.round(WEIGHTS.budget * 0.4); // 40% partial — suspiciously cheap
  }

  return 0; // Too expensive
}


// ─────────────────────────────────────────────────────────
//  SCORE 3: GENDER PREFERENCE
//  Full score  → listing accepts user's gender
//  Zero score  → listing gender requirement doesn't match
//
//  Listing preferredTenant.gender:  "male" | "female" | "any"
//  User gender:                     "male" | "female" | "other" | "prefer_not_to_say"
// ─────────────────────────────────────────────────────────
function scoreGenderMatch(userGender, listingGenderPref) {
  if (!listingGenderPref || listingGenderPref === "any") {
    // Listing accepts anyone → full score
    return WEIGHTS.gender;
  }

  if (!userGender || userGender === "prefer_not_to_say") {
    // User didn't specify → partial (listing may or may not accept)
    return Math.round(WEIGHTS.gender * 0.5);
  }

  // User said "other" — most "male"/"female" only listings may not apply
  if (userGender === "other") {
    return listingGenderPref === "any"
      ? WEIGHTS.gender
      : Math.round(WEIGHTS.gender * 0.3); // low chance of match
  }

  // Direct match: user is "male" and listing wants "male"
  if (normalise(userGender) === normalise(listingGenderPref)) {
    return WEIGHTS.gender; // full score
  }

  return 0; // mismatch — e.g. user is female but listing wants male only
}


// ─────────────────────────────────────────────────────────
//  SCORE 4: SMOKING PREFERENCE
//  This compares user's smoking habit vs listing's preference.
//
//  Possible values:
//    User:    "smoker" | "non_smoker" | "okay_with_smoking" | "no_preference"
//    Listing: [Note: listing doesn't store this — we compare
//             listing's postedBy user's smokingPreference]
//
//  Match table:
//    User is smoker       + Lister is smoker            → FULL
//    User is smoker       + Lister is okay_with_smoking → FULL
//    User is smoker       + Lister is non_smoker        → ZERO (conflict!)
//    User is non_smoker   + Lister is non_smoker        → FULL
//    User is non_smoker   + Lister is smoker            → LOW
//    Either has no_preference                           → PARTIAL
// ─────────────────────────────────────────────────────────
function scoreSmokingMatch(userSmoking, listerSmoking) {
  // If either side has no preference, give partial score
  if (!userSmoking   || userSmoking   === "no_preference") return Math.round(WEIGHTS.smoking * 0.6);
  if (!listerSmoking || listerSmoking === "no_preference") return Math.round(WEIGHTS.smoking * 0.6);

  const u = normalise(userSmoking);
  const l = normalise(listerSmoking);

  // Perfect matches
  if (u === l) return WEIGHTS.smoking; // same habit = full score

  // Smoker looking for a place where smoking is okay
  if (u === "smoker" && l === "okay_with_smoking") return WEIGHTS.smoking;
  if (u === "okay_with_smoking" && l === "smoker")  return WEIGHTS.smoking;

  // Non-smoker and smoking is around — uncomfortable but tolerable
  if (u === "non_smoker" && l === "okay_with_smoking") return Math.round(WEIGHTS.smoking * 0.5);
  if (u === "okay_with_smoking" && l === "non_smoker") return Math.round(WEIGHTS.smoking * 0.5);

  // Conflict: smoker meets strict non-smoker
  if ((u === "smoker" && l === "non_smoker") ||
      (u === "non_smoker" && l === "smoker")) {
    return 0; // incompatible — hard conflict
  }

  return Math.round(WEIGHTS.smoking * 0.4); // other edge cases
}


// ─────────────────────────────────────────────────────────
//  SCORE 5: FOOD PREFERENCE
//  Vegetarian + Vegetarian = perfect
//  Vegetarian + Non-veg   = may be uncomfortable
//
//  Possible values: "vegetarian" | "non_vegetarian" | "vegan" | "no_preference"
// ─────────────────────────────────────────────────────────
function scoreFoodMatch(userFood, listerFood) {
  if (!userFood   || userFood   === "no_preference") return Math.round(WEIGHTS.food * 0.6);
  if (!listerFood || listerFood === "no_preference") return Math.round(WEIGHTS.food * 0.6);

  const u = normalise(userFood);
  const l = normalise(listerFood);

  if (u === l) return WEIGHTS.food; // exact match = full score

  // Vegan and vegetarian are closely compatible (both avoid meat)
  if ((u === "vegan" && l === "vegetarian") ||
      (u === "vegetarian" && l === "vegan")) {
    return Math.round(WEIGHTS.food * 0.7); // good compatibility
  }

  // Mixed: one is veg/vegan, other is non-veg — possible friction
  if ((u === "vegetarian" || u === "vegan") && l === "non_vegetarian") {
    return Math.round(WEIGHTS.food * 0.3); // low compatibility
  }
  if (u === "non_vegetarian" && (l === "vegetarian" || l === "vegan")) {
    return Math.round(WEIGHTS.food * 0.3); // low compatibility
  }

  return Math.round(WEIGHTS.food * 0.4);
}


// ─────────────────────────────────────────────────────────
//  SCORE 6: OCCUPATION MATCH
//  Students often prefer other students (similar schedules)
//  Working professionals often prefer other working people
//
//  Listing stores: preferredTenant.studentOrWorking
//    → "student" | "working" | "any"
//  User stores: occupation (free text like "Software Engineer",
//    "MBA Student", etc.) — we detect student/working from text
// ─────────────────────────────────────────────────────────
function scoreOccupationMatch(userOccupation, listingOccupationPref) {
  if (!listingOccupationPref || listingOccupationPref === "any") {
    return WEIGHTS.occupation; // listing accepts anyone → full score
  }

  if (!userOccupation) {
    return Math.round(WEIGHTS.occupation * 0.5); // no info = partial
  }

  const occupationText = normalise(userOccupation);
  const listingPref    = normalise(listingOccupationPref);

  // Detect if user is a student (looks for keywords in their occupation)
  const studentKeywords = ["student", "studying", "college", "university", "school", "intern", "fresher"];
  const isStudent = studentKeywords.some(kw => occupationText.includes(kw));

  // Detect if user is working
  const workingKeywords = ["engineer", "manager", "developer", "doctor", "teacher", "professional",
                           "analyst", "consultant", "executive", "officer", "designer", "architect"];
  const isWorking = workingKeywords.some(kw => occupationText.includes(kw)) || (!isStudent && occupationText.length > 2);

  if (listingPref === "student" && isStudent)  return WEIGHTS.occupation;
  if (listingPref === "working" && isWorking)  return WEIGHTS.occupation;
  if (listingPref === "student" && isWorking)  return Math.round(WEIGHTS.occupation * 0.3);
  if (listingPref === "working" && isStudent)  return Math.round(WEIGHTS.occupation * 0.3);

  return Math.round(WEIGHTS.occupation * 0.5);
}


// ─────────────────────────────────────────────────────────
//  MAIN FUNCTION: calculateCompatibilityScore
//
//  @param  {Object} userProfile   - The logged-in user's profile
//  @param  {Object} listing       - A listing document from MongoDB
//  @returns {Object}              - { score, breakdown, label, color }
//
//  USAGE EXAMPLE:
//    const result = calculateCompatibilityScore(user, listing);
//    console.log(result.score);     // e.g. 78
//    console.log(result.label);     // e.g. "Good Match"
// ─────────────────────────────────────────────────────────
function calculateCompatibilityScore(userProfile, listing) {
  // ── Pull out the lister's profile (the person who posted) ──
  // listing.postedBy should be populated (i.e., full user object, not just ID)
  const lister = listing.postedBy;

  // ── Calculate individual scores ────────────────────────
  const cityScore       = scoreCityMatch(
    userProfile.city,
    listing.location?.city
  );

  const budgetScore     = scoreBudgetMatch(
    userProfile.budget,
    listing.rent?.amount
  );

  const genderScore     = scoreGenderMatch(
    userProfile.gender,
    listing.preferredTenant?.gender
  );

  const smokingScore    = scoreSmokingMatch(
    userProfile.smokingPreference,
    lister?.smokingPreference  // compare with the lister's preference
  );

  const foodScore       = scoreFoodMatch(
    userProfile.foodPreference,
    lister?.foodPreference    // compare with the lister's preference
  );

  const occupationScore = scoreOccupationMatch(
    userProfile.occupation,
    listing.preferredTenant?.studentOrWorking
  );

  // ── Add all scores together ────────────────────────────
  const totalScore = cityScore + budgetScore + genderScore +
                     smokingScore + foodScore + occupationScore;

  // Clamp between 0 and 100 (just in case of rounding issues)
  const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

  // ── Generate a human-readable label ──────────────────────
  // This makes it easy to display in the UI
  const label = getMatchLabel(finalScore);
  const color = getMatchColor(finalScore);

  // ── Return everything the frontend needs ─────────────────
  return {
    score: finalScore,     // 0-100 integer
    label,                 // e.g. "Great Match"
    color,                 // e.g. "#22c55e" (green)
    breakdown: {           // detailed scores for each factor
      city:       { score: cityScore,       weight: WEIGHTS.city       },
      budget:     { score: budgetScore,     weight: WEIGHTS.budget     },
      gender:     { score: genderScore,     weight: WEIGHTS.gender     },
      smoking:    { score: smokingScore,    weight: WEIGHTS.smoking    },
      food:       { score: foodScore,       weight: WEIGHTS.food       },
      occupation: { score: occupationScore, weight: WEIGHTS.occupation },
    },
  };
}


// ─────────────────────────────────────────────────────────
//  LABEL HELPER
//  Returns a friendly label based on the score
// ─────────────────────────────────────────────────────────
function getMatchLabel(score) {
  if (score >= 85) return "Perfect Match";
  if (score >= 70) return "Great Match";
  if (score >= 55) return "Good Match";
  if (score >= 40) return "Fair Match";
  if (score >= 25) return "Low Match";
  return "Poor Match";
}


// ─────────────────────────────────────────────────────────
//  COLOR HELPER
//  Returns a hex color based on the score (for the badge)
// ─────────────────────────────────────────────────────────
function getMatchColor(score) {
  if (score >= 85) return "#16a34a"; // deep green — perfect
  if (score >= 70) return "#22c55e"; // green — great
  if (score >= 55) return "#84cc16"; // lime — good
  if (score >= 40) return "#f59e0b"; // amber — fair
  if (score >= 25) return "#f97316"; // orange — low
  return "#ef4444";                   // red — poor
}


// ─────────────────────────────────────────────────────────
//  EXPORTS — make these functions available to other files
// ─────────────────────────────────────────────────────────
module.exports = {
  calculateCompatibilityScore,
  getMatchLabel,
  getMatchColor,
  WEIGHTS,
};
