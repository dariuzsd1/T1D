import { extractEntities } from "../lib/ocrExtractor";

const testCases = [
  "HUMALOG 100 units/mL lispro 5x 3mL Prefilled Pens", // Ideal
  "D&xcam Gf Sensor Continuous Gluco.. 3 P8ck LOT: AX119", // Glare/Typos
  "Insulet OMNIPOD DASH Pods sn: 99120344 REF 1239-1 EXP 01/2026", // Missing qty
  "Apple iPhone 15 Pro Max 256GB" // Total Failure (No Meds)
];

console.log("=== BEGIN OCR-TO-JSON EXTRACTION LOG ===");

testCases.forEach((t, i) => {
    console.log(`\n--- TEST CASE ${i + 1} ---`);
    console.log(`[RAW OCR TEXT] -> "${t}"`);
    
    const res = extractEntities(t);
    
    console.log(`\n[PARSED JSON]`);
    console.log(JSON.stringify(res.parsedData, null, 2));
    
    if (res.mismatchesLog.length > 0) {
        console.log(`\n🚨 MISMATCHES / FAILURES DETECTED 🚨`);
        res.mismatchesLog.forEach(m => console.log(`   🔸 ${m}`));
    } else {
        console.log(`\n✅ EXTRACTION SUCCESS (No Parsing Breaks)`);
    }
});
