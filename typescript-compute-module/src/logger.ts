export interface LogParams {
  session_id?: string;
  process_id?: string;
  job_id?: string;
  [key: string]: unknown;
}

export interface Logger {
  log: (message: string, params?: LogParams) => void;
  debug?: (message: string, params?: LogParams) => void;
  error: (message: string, params?: LogParams) => void;
  info: (message: string, params?: LogParams) => void;
  warn: (message: string, params?: LogParams) => void;
}

/**
 * Wraps a logger with an instance ID prefix and base params injected into every log call.
 */
export function loggerToInstanceLogger(
  logger: Logger,
  instanceId?: string,
  baseParams?: LogParams
): Logger {
  const prefix = instanceId != null ? `[${instanceId}] ` : "";

  function mergeParams(params?: LogParams): LogParams | undefined {
    if (baseParams == null && params == null) return undefined;
    return { ...baseParams, ...params };
  }

  return {
    log: (message, params) =>
      logger.log(`${prefix}${message}`, mergeParams(params)),
    debug: logger.debug
      ? (message, params) =>
          logger.debug!(`${prefix}${message}`, mergeParams(params))
      : undefined,
    error: (message, params) =>
      logger.error(`${prefix}${message}`, mergeParams(params)),
    info: (message, params) =>
      logger.info(`${prefix}${message}`, mergeParams(params)),
    warn: (message, params) =>
      logger.warn(`${prefix}${message}`, mergeParams(params)),
  };
}
