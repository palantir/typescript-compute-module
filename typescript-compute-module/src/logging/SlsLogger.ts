import { isMainThread, threadId } from "node:worker_threads";
import type { Logger, LogParams } from "../logger";
import { queryContextStorage } from "../QueryRunner";

type SlsLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

/**
 * Logger that writes SLS-formatted JSON to stdout for telemetry sidecar parsing.
 *
 * The `origin` field is automatically set to the caller's `filename:line`,
 * and the `thread` field reflects the current worker thread (matching the
 * Python SDK's behaviour).
 *
 * @example
 * ```typescript
 * import { SlsLogger, ComputeModule } from "@palantir/compute-module";
 *
 * const module = new ComputeModule({
 *   logger: new SlsLogger(),
 *   definitions: { ... },
 * });
 * ```
 */
export class SlsLogger implements Logger {
  debug(message: string, params?: LogParams): void {
    this.write("DEBUG", message, params);
  }

  log(message: string, params?: LogParams): void {
    this.write("INFO", message, params);
  }

  info(message: string, params?: LogParams): void {
    this.write("INFO", message, params);
  }

  warn(message: string, params?: LogParams): void {
    this.write("WARN", message, params);
  }

  error(message: string, params?: LogParams): void {
    this.write("ERROR", message, params);
  }

  private write(
    level: SlsLogLevel,
    message: string,
    params?: LogParams
  ): void {
    const context = queryContextStorage.getStore();
    const baseParams: Record<string, string> = {
      session_id: process.env["COMPUTE_SESSION_ID"] ?? "",
      process_id: String(process.pid),
      job_id: context?.jobId ?? "",
    };
    const entry = {
      type: "service.1",
      level,
      time: new Date().toISOString(),
      origin: getCallerOrigin(),
      safe: true,
      thread: isMainThread ? "main" : `worker-${threadId}`,
      params: filterUndefinedValues({ ...baseParams, ...params }),
      message,
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  }
}

/**
 * Extracts the caller's `filename:line` from the stack trace, matching the
 * Python SDK's `f"{record.filename}:{record.lineno}"` behaviour.
 *
 * Uses V8's `Error.prepareStackTrace` to obtain structured CallSite objects
 * directly, avoiding full stack serialization and regex parsing.
 *
 * Frame indices (from `write`):
 *   0: getCallerOrigin
 *   1: SlsLogger.write
 *   2: SlsLogger.(debug|log|info|warn|error)
 *   3: <actual caller>
 */
function getCallerOrigin(): string {
  const original = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_err, stack) => stack;
    const { stack } = new Error();

    const callSites = stack as unknown as NodeJS.CallSite[];
    const caller = callSites?.[3];
    if (caller == null) return "unknown";

    const filePath = caller.getFileName();
    const lineNumber = caller.getLineNumber();
    if (filePath == null || lineNumber == null) return "unknown";

    const fileName = filePath.split("/").pop() ?? filePath;
    return `${fileName}:${lineNumber}`;
  } finally {
    Error.prepareStackTrace = original;
  }
}

function filterUndefinedValues(
  params: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined)
  );
}
