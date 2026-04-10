import { runPipeline } from "../src/lib/pipeline";
import { logger } from "../src/lib/telemetry";

const TEST_SCENARIOS = [
    { name: "Omnipod Dash (Clean)", text: "Omnipod Dash Pods 10 pack", score: 95 },
    { name: "Dexcom G6 (Typo)", text: "D&xcam Gf Sensors contains 3", score: 70 },
    { name: "Humalog (Partial)", text: "Humalog Lispro Insulin 5 items", score: 85 },
    { name: "Empty Input", text: "", score: 100 },
    { name: "Trash Image", text: "Coca Cola bottle 500ml", score: 98 },
    { name: "Partial OCR", text: "Pod 10x", score: 50 },
    { name: "Dexcom G7 (New)", text: "Dexcom G7 Sensor ea 1", score: 90 },
    { name: "Lantus Pen", text: "Lantus SoloStar Pen 5 pack", score: 92 },
    // Add more to reach 20+ scenarios
    { name: "Noise 1", text: "!!! @#$ %^& *()", score: 10 },
    { name: "Omnipod 5", text: "Omnipod 5 Generation 10ea", score: 95 },
    { name: "Very Blurry Dexcom", text: "xc m g 6", score: 30 },
    { name: "Multiple Products", text: "Omnipod and Dexcom G6", score: 90 },
    { name: "Case Change", text: "hUmAlOg LiSpRo", score: 100 },
    { name: "Quantity Only", text: "10 pack items", score: 100 },
    { name: "Brand Only", text: "Insulet Corporation", score: 100 },
    { name: "Glared G6", text: "D e x c o m G 6", score: 60 },
    { name: "Refill String", text: "Refill 5 pods dash", score: 80 },
    { name: "Large Quantity", text: "Humalog 100 vials", score: 90 },
    { name: "Small Text", text: "omnipod dash ... small font ... 10 count", score: 40 },
    { name: "Handwritten style", text: "0mnipod dsh pds", score: 55 },
    { name: "Abbott Libre (Typo)", text: "fresstyle lbre 3", score: 88 }
];

async function runAudit() {
    console.log("=== STARTING BACKEND PIPELINE AUDIT ===");
    let successes = 0;
    let failures = 0;
    const startTime = Date.now();

    for (const scenario of TEST_SCENARIOS) {
        console.log(`\nTesting: ${scenario.name}...`);
        try {
            const result = await runPipeline(scenario.text, scenario.score);
            
            const isSuccess = result.status !== "ERROR" && result.status !== "FAILED";
            if (isSuccess) {
                successes++;
                console.log(`✅ Result: ${result.status} | Confidence: ${result.confidence_metrics.aggregated}%`);
            } else {
                failures++;
                console.log(`❌ Result: ${result.status} | Action: ${result.ui_routing}`);
            }
        } catch (e: any) {
            failures++;
            console.log(`💥 CRASH in scenario: ${e.message}`);
        }
    }

    const duration = Date.now() - startTime;
    const successRate = (successes / TEST_SCENARIOS.length) * 100;

    console.log("\n" + "=".repeat(40));
    console.log("AUDIT RESULTS:");
    console.log(`Total Scenarios: ${TEST_SCENARIOS.length}`);
    console.log(`Successes: ${successes}`);
    console.log(`Failures: ${failures}`);
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`Total Time: ${duration}ms (${(duration/TEST_SCENARIOS.length).toFixed(1)}ms/req)`);
    console.log("=".repeat(40));

    if (successRate < 85) {
        console.log("\n[!] RELIABILITY BELOW 85%. DO NOT PROCEED TO UI.");
    } else {
        console.log("\n[+] RELIABILITY ACCEPTABLE. READY FOR UI.");
    }
}

// Start Audit
runAudit();
