// Reads the message from anything a catch block can receive.
export const getErrorMessage = (err: unknown): string => (err instanceof Error ? err.message : '');
