export function isDebug(): boolean {
  return process.env.DEBUG === "true";
}

export function debugLog(...args: unknown[]) {
  if (!isDebug()) return;
  console.info("[debug]", ...args);
}

export function debugWarn(...args: unknown[]) {
  if (!isDebug()) return;
  console.warn("[debug]", ...args);
}

const API_KEY_REGEX = /(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]{32,}/g;
const OPENAI_PREFIX_REGEX = /sk-[A-Za-z0-9]{10,}/g;
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9-_.]+/gi;

export function redact(input: string): string {
  return input
    .replace(OPENAI_PREFIX_REGEX, "***REDACTED***")
    .replace(BEARER_REGEX, "***REDACTED***")
    .replace(API_KEY_REGEX, "***REDACTED***");
}
