export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toDisplayLines(input: string): string[] {
  return input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function splitParagraphs(input: string): string[] {
  return input
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

export function truncate(input: string, max = 220): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export function containsUnconfirmed(input: string): boolean {
  return /por confirmar/i.test(input);
}
