/**
 * Utility functions for handling unknown error types in TypeScript
 */

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function createErrorFromUnknown(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error('Unknown error occurred');
}

export function logErrorSafely(error: unknown, context?: string): void {
  const message = getErrorMessage(error);
  const contextStr = context ? `[${context}] ` : '';
  console.error(`${contextStr}${message}`);
  
  if (error instanceof Error && error.stack) {
    console.error('Stack:', error.stack);
  }
}