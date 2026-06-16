import { runPipeline } from "../src/lib/pipeline";
import { UserProfile } from "../src/lib/durationEstimator";

const profileComplete: UserProfile = {
    average_daily_basal: 22,
    average_daily_bolus: 18,
    frequency_overrides: { "1001": 4 },
};

const profileEmpty: UserProfile = {};

const testCases = [
    {
        label: "✅ HAPPY PATH — Omnipod Dash 5-Pack, Full Profile",
        raw: "Insulet OMNIPOD DASH Pods 5 pack EXP 01/2026",
        ocrScore: 92,
        profile: profileComplete,
    },
    {
        label: "⚠️  LOW OCR + STRONG MATCH — Dexcom G6 (Blurry Scan)",
        raw: "D&xcam Gf Sensor 3 pack LOT: AX119",
        ocrScore: 45,
        profile: profileComplete,
    },
    {
        label: "⚠️  MISSING TDD — Humalog Pens, Empty Profile",
        raw: "HUMALOG 100 units/mL lispro 5x 3mL Prefilled Pens",
        ocrScore: 88,
        profile: profileEmpty,
    },
    {
        label: "🚨 TOTAL FAILURE — Unrelated Product",
        raw: "Apple iPhone 15 Pro Max 256GB",
        ocrScore: 98,
        profile: profileComplete,
    },
    {
        label: "🚨 FATAL ERROR — Empty OCR Text",
        raw: "",
        ocrScore: 0,
        profile: profileComplete,
    },
];

console.log("=== FULL PIPELINE INTEGRATION TEST ===\n");

testCases.forEach(async (tc, i) => {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`TEST ${i + 1}: ${tc.label}`);
    console.log(`${"═".repeat(60)}`);

    const output = await runPipeline(tc.raw, tc.ocrScore, tc.profile);

    // Print structured JSON output
    console.log(JSON.stringify({
        status:     output.status,
        ui_routing: output.ui_routing,
        confidence: output.confidence_metrics,
        extraction: output.extraction,
        top_match:  output.api_match.topMatches[0] ?? null,
        duration:   output.duration,
    }, null, 2));

    // Print debug log separately
    console.log("\n── DEBUG LOG ──");
    output.debug_logs.forEach(l => console.log(`  [${l.level}] ${l.stage}: ${l.message}`));
});

console.log(`\n${"═".repeat(60)}`);
console.log("=== FULL PIPELINE TEST COMPLETE ===");
