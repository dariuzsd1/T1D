import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

/**
 * GET /api/health
 * Production Health Monitoring for the T1D Pipeline.
 */
export async function GET(req: NextRequest) {
    const start = Date.now();
    
    let ocrStatus = "ok";
    let apiStatus = "ok";
    let pipelineStatus = "ok";
    
    try {
        // Test 1: Fast Pipeline Check
        const testRun = await runPipeline("Health Check Omnipod 5", 100);
        if (testRun.status === "ERROR") pipelineStatus = "fail";
        if (testRun.api_match.status === "FAILED") apiStatus = "degraded";
        
    } catch (e) {
        pipelineStatus = "fail";
    }

    const latency = Date.now() - start;

    return NextResponse.json({
        ocr: ocrStatus,
        api: apiStatus,
        pipeline: pipelineStatus,
        latency_ms: latency,
        last_tested: new Date().toISOString(),
        version: "1.0.0-audit"
    });
}
