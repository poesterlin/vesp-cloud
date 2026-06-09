type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL = (typeof process !== 'undefined' && process.env.LOG_LEVEL) || 'info';
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL as LogLevel] || LEVELS[LOG_LEVEL as LogLevel] === undefined;
}

function formatMessage(level: LogLevel, correlationId: string, message: string): string {
  const ts = new Date().toISOString();
  return `${ts} [${level.toUpperCase()}] [${correlationId}] ${message}`;
}

export function createLogger(correlationId: string) {
  return {
    debug: (msg: string) => {
      if (shouldLog('debug')) console.debug(formatMessage('debug', correlationId, msg));
    },
    info: (msg: string) => {
      if (shouldLog('info')) console.log(formatMessage('info', correlationId, msg));
    },
    warn: (msg: string) => {
      if (shouldLog('warn')) console.warn(formatMessage('warn', correlationId, msg));
    },
    error: (msg: string) => {
      if (shouldLog('error')) console.error(formatMessage('error', correlationId, msg));
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
