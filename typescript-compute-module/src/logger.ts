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
 * Wraps a logger with an instance ID prefix injected into every log call.
 */
export const loggerToInstanceLogger = (
  logger: Logger,
  instanceId?: string
): Logger => {
  const prefix = instanceId != null ? `[${instanceId}] ` : "";

  return {
    log: (message, params) =>
      logger.log(`${prefix}${message}`, params),
    debug: logger.debug
      ? (message, params) =>
          logger.debug!(`${prefix}${message}`, params)
      : undefined,
    error: (message, params) =>
      logger.error(`${prefix}${message}`, params),
    info: (message, params) =>
      logger.info(`${prefix}${message}`, params),
    warn: (message, params) =>
      logger.warn(`${prefix}${message}`, params),
  };
};
