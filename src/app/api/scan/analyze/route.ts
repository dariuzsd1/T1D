import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { logger } from "@/lib/telemetry";

/**
 * POST /api/scan/analyze
 *
 * Integrated production analyze route using the async pipeline orchestrator.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const rawText: string = body.raw_ocr_text ?? "";
        const ocrScore: number = body.ocr_hardware_score ?? 0;
        const profile = body.user_profile ?? {};

        // Execute unified async pipeline
        const result = await runPipeline(rawText, ocrScore, profile);

        return NextResponse.json(result);

    } catch (err: any) {
        logger.log("API_ROUTE", `Fatal API error: ${err.message}`, "ERROR");
        return NextResponse.json({
            status: "ERROR",
            ui_routing: "MANUAL_ENTRY",
            message: err?.message || "Internal server error occurred.",
            debug_logs: logger.getLogs()
        }, { status: 500 });
    }
}
