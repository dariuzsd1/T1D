/**
 * lib/telemetry.ts
 * Structured logging and observability for the T1D Pipeline.
 */

export interface LogEntry {
    timestamp: string;
    level: "INFO" | "WARN" | "ERROR" | "DEBUG";
    stage: string;
    message: string;
    context?: any;
}

export class PipelineLogger {
    private logs: LogEntry[] = [];

    log(stage: string, message: string, level: LogEntry["level"] = "INFO", context?: any) {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            stage,
            message,
            context: context ? JSON.parse(JSON.stringify(context)) : undefined // Snapshot
        };
        this.logs.push(entry);
        
        // Print to console for server logs
        const color = level === "ERROR" ? "\x1b[31m" : level === "WARN" ? "\x1b[33m" : "\x1b[32m";
        console.log(`${color}[${entry.timestamp}] [${level}] [${stage}]\x1b[0m ${message}`);
    }

    getLogs() {
        return this.logs;
    }

    clear() {
        this.logs = [];
    }
}

export const logger = new PipelineLogger();

/**
 * Custom Error Classes for T1D Pipeline
 */
export class PipelineError extends Error {
    constructor(public stage: string, message: string, public isFatal: boolean = false) {
        super(message);
        this.name = "PipelineError";
    }
}

/**
 * Retry utility with exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    stage: string,
    retries: number = 3,
    delay: number = 500
): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries <= 0) throw error;
        
        // Handle Rate Limits specifically
        const isRateLimit = error?.status === 429;
        const waitTime = isRateLimit ? delay * 4 : delay;
        
        logger.log(stage, `Retry attempt remaining: ${retries}. Waiting ${waitTime}ms...`, "WARN");
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return withRetry(fn, stage, retries - 1, delay * 2);
    }
}
