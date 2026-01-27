/**
 * Standard environment variable declarations for the compiler.
 * This fixes the 'vite/client' not found error and defines expected env vars.
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly API_KEY: string;
    }
  }
}

export {};
