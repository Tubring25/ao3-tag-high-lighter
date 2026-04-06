export function normalizeTagText(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}
