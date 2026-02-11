export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

class LoggerService {
    private level: LogLevel = LogLevel.INFO;

    constructor() {
        // Determine initial log level
        // In Vite, import.meta.env.DEV is true during development
        // We can also allow a local storage override for debugging in production
        const savedLevel = localStorage.getItem('log_level');

        if (savedLevel !== null) {
            this.level = parseInt(savedLevel, 10);
        } else if (import.meta.env.DEV) {
            this.level = LogLevel.DEBUG;
        }
    }

    public setLevel(level: LogLevel) {
        this.level = level;
        localStorage.setItem('log_level', level.toString());
    }

    private formatMessage(level: string, message: string, context?: any) {
        const timestamp = new Date().toLocaleTimeString();
        const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level}] ${message}${contextStr}`;
    }

    public debug(message: string, ...args: any[]) {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(`🐞 ${message}`, ...args);
        }
    }

    public info(message: string, ...args: any[]) {
        if (this.level <= LogLevel.INFO) {
            console.info(`ℹ️ ${message}`, ...args);
        }
    }

    public warn(message: string, ...args: any[]) {
        if (this.level <= LogLevel.WARN) {
            console.warn(`⚠️ ${message}`, ...args);
        }
    }

    public error(message: string, ...args: any[]) {
        if (this.level <= LogLevel.ERROR) {
            console.error(`🚨 ${message}`, ...args);
        }
    }
}

export const Logger = new LoggerService();
