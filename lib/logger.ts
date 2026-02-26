
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

class Logger {
  private static instance: Logger;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private format(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    return {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };
  }

  private output(entry: LogEntry) {
    // In production, this would send to Sentry, DataDog, etc.
    const output = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
    
    switch (entry.level) {
      case 'error':
        console.error(output, entry.context || '');
        break;
      case 'warn':
        console.warn(output, entry.context || '');
        break;
      case 'info':
      case 'debug':
        console.log(output, entry.context || '');
        break;
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    this.output(this.format('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.output(this.format('warn', message, context));
  }

  error(message: string, context?: Record<string, unknown>) {
    this.output(this.format('error', message, context));
  }
}

export const logger = Logger.getInstance();
