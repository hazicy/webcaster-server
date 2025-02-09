export class Logger {
  private static prefix: string = "";

  static setPrefix(prefix: string): void {
    Logger.prefix = prefix;
  }

  private static log(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const prefixString = Logger.prefix ? `[${Logger.prefix}] ` : "";
    console.log(`${timestamp} ${level} ${prefixString}${message}`, ...args);
  }

  static info(message: string, ...args: any[]): void {
    Logger.log("[INFO]", message, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    Logger.log("[WARN]", message, ...args);
  }

  static error(message: string, ...args: any[]): void {
    Logger.log("[ERROR]", message, ...args);
  }

  static debug(message: string, ...args: any[]): void {
    Logger.log("[DEBUG]", message, ...args);
  }
}
