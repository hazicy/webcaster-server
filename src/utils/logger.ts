export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(...args: any[]) {
    console.log(`[${this.context}] [INFO]`, ...args);
  }

  error(...args: any[]) {
    console.error(`[${this.context}] [ERROR]`, ...args);
  }

  warn(...args: any[]) {
    console.warn(`[${this.context}] [WARN]`, ...args);
  }

  debug(...args: any[]) {
    console.debug(`[${this.context}] [DEBUG]`, ...args);
  }
}
