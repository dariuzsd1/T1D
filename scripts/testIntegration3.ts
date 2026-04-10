import { extractEntities } from "../lib/ocrExtractor";
import { executeAPIMatch } from "../lib/apiMatcher";
import { estimateDuration, UserProfile } from "../lib/durationEstimator";

// Simulated User Profiles
const profileComplete: UserProfile = {
    average_daily_basal: 22,
    average_daily_bolus: 18,
    frequency_overrides: { "1001": 4 }, // User stretches Omnipod pods to 4 days
};

const profileMissingTDD: UserProfile = {
    average_daily_basal: undefined,
    average_daily_bolus: undefined,
};

const testCases = [
    {
        label: "Omnipod Dash (qty present, user override 4 days)",
        raw: "Insulet OMNIPOD DASH Pods 5 pack EXP 01/2026",
        profile: profileComplete,
    },
    {
        label: "Humalog Pen Box (complete profile, TDD 40 U/day)",
        raw: "HUMALOG 100 units/mL lispro 5x 3mL Prefilled Pens",
        profile: profileComplete,
    },
    {
        label: "Lantus (missing TDD → prompt user)",
        raw: "Lantus SoloStar Pen glargine 3 pens",
        profile: profileMissingTDD,
    },
    {
        label: "Dexcom G6 (missing quantity → prompt user)",
        raw: "Dexcom G6 Sensor Continuous Glucose Monitor",
        profile: profileComplete,
    },
];

console.log("=== INTEGRATION TEST 3: OCR → EXTRACTION → API MATCH → DURATION ===\n");

testCases.forEach((tc, i) => {
    console.log(`────────────────────────────────────────────────────`);
    console.log(`TEST ${i + 1}: ${tc.label}`);
    console.log(`────────────────────────────────────────────────────`);
    console.log(`[1] RAW OCR: "${tc.raw}"`);

    // Stage 1: Extract
    const extraction = extractEntities(tc.raw);
    console.log(`[2] EXTRACTION: ${extraction.status} | Qty: ${extraction.parsedData.quantity ?? "null"} | Brand: ${extraction.parsedData.brand ?? "null"}`);

    // Stage 2: API Match
    const matchResult = executeAPIMatch(extraction);
    if (matchResult.status === "FAILED" || matchResult.topMatches.length === 0) {
        console.log(`[3] API MATCH: FAILED — pipeline halted, manual entry required.\n`);
        return;
    }
    const topMatch = matchResult.topMatches[0];
    console.log(`[3] API MATCH: ${topMatch.brand} - ${topMatch.name} (${topMatch.confidenceScore}%)`);

    // Stage 3: Duration
    const duration = estimateDuration(topMatch, extraction, tc.profile);
    console.log(`[4] DURATION RESULT:`);

    if (duration.missing_variables_prompt) {
        console.log(`    ⚠️  MISSING DATA → Prompt to user: "${duration.missing_variables_prompt}"`);
        console.log(`    Estimated Duration : null`);
        console.log(`    Refill Date        : null`);
    } else {
        console.log(`    ✅ Estimated Duration : ${duration.estimated_duration_days} days`);
        console.log(`    ✅ Refill Date        : ${duration.refill_date}`);
        console.log(`    Confidence           : ${duration.confidence}`);
    }

    console.log("");
});

console.log("=== INTEGRATION TEST 3 COMPLETE ===");
