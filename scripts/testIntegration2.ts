import { extractEntities } from "../lib/ocrExtractor";
import { executeAPIMatch } from "../lib/apiMatcher";

const testCases = [
    { label: "Ideal: Humalog Pen Box",         raw: "HUMALOG 100 units/mL lispro 5x 3mL Prefilled Pens" },
    { label: "Typo: Dexcom G6 (Glare)",        raw: "D&xcam Gf Sensor Continuous Gluco.. 3 P8ck LOT: AX119" },
    { label: "Missing Qty: Omnipod Dash",       raw: "Insulet OMNIPOD DASH Pods sn: 99120344 REF 1239-1 EXP 01/2026" },
    { label: "Total Failure: Unrelated Item",   raw: "Apple iPhone 15 Pro Max 256GB" },
];

console.log("=== BEGIN INTEGRATION TEST: OCR → ENTITY EXTRACTION → API MATCHING ===\n");

testCases.forEach((tc, i) => {
    console.log(`────────────────────────────────────────────`);
    console.log(`TEST CASE ${i + 1}: ${tc.label}`);
    console.log(`────────────────────────────────────────────`);
    console.log(`[1] RAW OCR TEXT : "${tc.raw}"`);

    // Step 1: Extract entities
    const extraction = extractEntities(tc.raw);
    console.log(`\n[2] PARSED JSON :`);
    console.log(JSON.stringify(extraction.parsedData, null, 2));
    console.log(`    OCR Status   : ${extraction.status} | Confidence: ${extraction.confidence.total}%`);

    if (extraction.mismatchesLog.length > 0) {
        console.log(`    ⚠️  EXTRACTION MISMATCHES:`);
        extraction.mismatchesLog.forEach(m => console.log(`       → ${m}`));
    }

    // Step 2: API match  
    const match = executeAPIMatch(extraction);
    console.log(`\n[3] API MATCH RESULT : ${match.status}`);

    if (match.topMatches.length > 0) {
        console.log(`    TOP MATCHES:`);
        match.topMatches.forEach((m, rank) => {
            const flag = m.confidenceScore > 85 ? "✅" : m.confidenceScore >= 60 ? "⚠️ " : "🚨";
            console.log(`    ${flag} #${rank + 1} ${m.brand} - ${m.name} (${m.confidenceScore}%)`);
        });
    }

    if (match.matchLogs.length > 0) {
        console.log(`    MATCH LOGS:`);
        match.matchLogs.forEach(log => console.log(`       → ${log}`));
    }

    console.log("");
});

console.log("=== INTEGRATION TEST COMPLETE ===");
