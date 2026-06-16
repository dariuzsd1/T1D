import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { logger } from "@/lib/telemetry";

// The OCR matcher is O(words³)·Fuse — unbounded text is a denial-of-service
// vector. Real supply labels are short, so cap intake well above any legitimate
// label and reject the rest before it reaches the pipeline.
const MAX_OCR_TEXT_LENGTH = 5000;

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

        if (typeof rawText !== "string" || rawText.length > MAX_OCR_TEXT_LENGTH) {
            return NextResponse.json({
                status: "ERROR",
                ui_routing: "MANUAL_ENTRY",
                message: `Scanned text is too large to process (limit ${MAX_OCR_TEXT_LENGTH} characters).`,
            }, { status: 413 });
        }

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
