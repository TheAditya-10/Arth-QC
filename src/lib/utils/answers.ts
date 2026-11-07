/**
 * Lightweight answer checker for practice quizzes.
 * Normalises formatting (spaces, commas, currency, case) and compares numerically
 * when both sides parse as numbers or simple fractions.
 */
export function normaliseAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/₹|rs\.?|inr/g, "")
    .replace(/[\s,]/g, "")
    .replace(/\.$/, "")
    .replace(/×/g, "x")
    .replace(/−/g, "-")
    .trim();
}

function toNumber(s: string): number | null {
  const n = normaliseAnswer(s);
  if (/^-?\d+(\.\d+)?$/.test(n)) return Number(n);
  const frac = n.match(/^(-?\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const mixed = n.match(/^(-?\d+)\((\d+)\/(\d+)\)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  return null;
}

export function checkAnswer(input: string, expected: string, accepts: string[] = []): boolean {
  if (!input.trim()) return false;
  const candidates = [expected, ...accepts];
  const ni = normaliseAnswer(input);
  const numI = toNumber(input);
  return candidates.some((c) => {
    if (normaliseAnswer(c) === ni) return true;
    const numC = toNumber(c);
    return numI !== null && numC !== null && Math.abs(numI - numC) < 1e-9;
  });
}
