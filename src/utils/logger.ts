// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

type LogMode = 'INFO' | 'DEBUG' | 'TRACE';

// Log mode configuration
const LOG_MODE: LogMode = (process.env.LOG_MODE as LogMode) || 'INFO';

function getTimestamp(): string {
  return new Date().toISOString();
}

function formatLog(level: string, ...args: any[]): string {
  return `[${getTimestamp()}] [${level}] ${args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
  ).join(' ')}`;
}

export function log(...args: any[]) {
  // INFO and DEBUG modes show regular logs
  if (LOG_MODE === 'INFO' || LOG_MODE === 'DEBUG' || LOG_MODE === 'TRACE') {
    console.log(formatLog('INFO', ...args));
  }
}

export function logDebug(...args: any[]) {
  // Only DEBUG mode shows debug logs
  if (LOG_MODE === 'DEBUG' || LOG_MODE === 'TRACE') {
    console.log(formatLog('DEBUG', ...args));
  }
}

export function logTrace(...args: any[]) {
  // Only DEBUG mode shows debug logs
  if (LOG_MODE === 'TRACE') {
    console.log(formatLog('TRACE', ...args));
  }
}

export function logError(...args: any[]) {
  // Always log errors regardless of mode
  console.error(formatLog('ERROR', ...args));
}
