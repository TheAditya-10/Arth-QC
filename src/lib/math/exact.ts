/**
 * Exact arithmetic for verifying Class 6 mathematics deterministically.
 *
 * Numbers are BigInt rationals — never floating point — so 0.1 + 0.2 === 3/10
 * exactly. Supports integers (incl. Indian digit grouping), decimals, fractions,
 * mixed numbers, percentages, unary minus, + − × ÷, parentheses and "of".
 * Anything outside this grammar returns null ("not verifiable") rather than a guess.
 */

export class Rational {
  readonly n: bigint;
  readonly d: bigint;
  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new RangeError("division by zero");
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n < 0n ? -n : n, d);
    this.n = n / g;
    this.d = d / g;
  }
  static of(v: bigint | number) {
    return new Rational(BigInt(v));
  }
  add(o: Rational) {
    return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rational) {
    return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rational) {
    return new Rational(this.n * o.n, this.d * o.d);
  }
  div(o: Rational) {
    if (o.n === 0n) throw new RangeError("division by zero");
    return new Rational(this.n * o.d, this.d * o.n);
  }
  neg() {
    return new Rational(-this.n, this.d);
  }
  equals(o: Rational) {
    return this.n === o.n && this.d === o.d;
  }
  toString() {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}

const UNIT_WORDS =
  /\b(rupees?|rs|inr|paise|cm|mm|km|m|metres?|meters?|kg|g|grams?|litres?|liters?|l|ml|degrees?|deg|units?|sq|square|cubic|hours?|hrs?|minutes?|mins?|seconds?|secs?|marks?|students?|books?|apples?|times?)\b\.?/gi;

/** Normalise notation; returns null when the text clearly isn't a pure numeric expression. */
export function normaliseMath(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s
    .replace(/[−–—]/g, "-")
    .replace(/[×✕✖]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[₹$]/g, "")
    .replace(/°/g, "")
    .replace(/\bof\b/g, "*")
    .replace(UNIT_WORDS, "")
    .replace(/\s+/g, " ")
    .trim();
  // Indian / international digit grouping: 4,66,875 or 466,875 (no space after comma).
  s = s.replace(/(\d),(?=\d{2,3}\b|\d{2},)/g, "$1");
  // Mixed numbers "2 1/3" → "(2+1/3)" (also handles "-2 1/3").
  s = s.replace(/(-?)(\d+) (\d+)\/(\d+)/g, (_m, sign, w, a, b) => `${sign}(${w}+${a}/${b})`);
  // Implicit "x" as multiplication between numbers: "3 x 4".
  s = s.replace(/(\d|\))\s*x\s*(?=[\d(])/g, "$1*");
  if (/[a-z]/.test(s)) return null; // leftover words → not a numeric expression
  return s.replace(/\s+/g, "");
}

/** Recursive-descent parser over the normalised string. */
export function evaluate(expr: string): Rational | null {
  const norm = normaliseMath(expr);
  if (!norm) return null;
  const s: string = norm;
  let i = 0;
  const peek = () => s[i];
  function number(): Rational | null {
    const m = /^(\d+)(?:\.(\d+))?/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    const intPart = BigInt(m[1]);
    let r = new Rational(intPart);
    if (m[2]) r = new Rational(BigInt(m[1] + m[2]), 10n ** BigInt(m[2].length));
    if (peek() === "%") {
      i++;
      r = r.div(Rational.of(100));
    }
    return r;
  }
  function factor(): Rational | null {
    if (peek() === "-") {
      i++;
      const f = factor();
      return f ? f.neg() : null;
    }
    if (peek() === "+") {
      i++;
      return factor();
    }
    if (peek() === "(") {
      i++;
      const v = exprP();
      if (peek() !== ")") return null;
      i++;
      if (peek() === "%") {
        i++;
        return v ? v.div(Rational.of(100)) : null;
      }
      return v;
    }
    return number();
  }
  function term(): Rational | null {
    let v = factor();
    while (v && (peek() === "*" || peek() === "/")) {
      const op = s[i++];
      const r = factor();
      if (!r) return null;
      try {
        v = op === "*" ? v.mul(r) : v.div(r);
      } catch {
        return null;
      }
    }
    return v;
  }
  function exprP(): Rational | null {
    let v = term();
    while (v && (peek() === "+" || peek() === "-")) {
      const op = s[i++];
      const r = term();
      if (!r) return null;
      v = op === "+" ? v.add(r) : v.sub(r);
    }
    return v;
  }
  try {
    const v = exprP();
    return v && i === s.length ? v : null;
  } catch {
    return null;
  }
}

/** Splits "23, 29, 31" or "acute; right" into items. Commas followed by a space separate items. */
export function splitList(s: string): string[] {
  return s
    .split(/;|,\s+|\band\b/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** The final value of a worked line: text after the last "=" (e.g. "5,000 + 18,000 = 23,000" → "23,000"). */
export function finalPart(s: string): string {
  const parts = s.split("=");
  return parts[parts.length - 1].trim();
}

export type Equivalence = true | false | null;

/**
 * Exact equivalence of two answers. Lists compare as multisets (order-insensitive).
 * Returns null when either side can't be verified deterministically.
 */
export function equivalentAnswers(student: string, expected: string): Equivalence {
  const a = finalPart(student);
  const b = finalPart(expected);
  const la = splitList(a);
  const lb = splitList(b);
  if (lb.length > 1 || la.length > 1) {
    const va = la.map(evaluate);
    const vb = lb.map(evaluate);
    if (va.some((v) => !v) || vb.some((v) => !v)) return null;
    if (va.length !== vb.length) return false;
    const rest = [...(vb as Rational[])];
    for (const v of va as Rational[]) {
      const idx = rest.findIndex((r) => r.equals(v));
      if (idx === -1) return false;
      rest.splice(idx, 1);
    }
    return true;
  }
  const va = evaluate(a);
  const vb = evaluate(b);
  if (!va || !vb) return null;
  return va.equals(vb);
}

/**
 * Checks each written step: every "=" chain must be internally consistent
 * (e.g. "854 × 2 = 1,608" is false). Steps that aren't pure arithmetic return null.
 */
export function verifyStep(step: string): Equivalence {
  if (!step.includes("=")) return null;
  const sides = step.split("=").map((x) => x.trim()).filter(Boolean);
  if (sides.length < 2) return null;
  const vals = sides.map(evaluate);
  if (vals.some((v) => !v)) return null;
  return (vals as Rational[]).every((v) => v.equals(vals[0] as Rational));
}

/** Is this answer purely numeric (so deterministic checking is authoritative)? */
export function isVerifiable(answer: string): boolean {
  const lb = splitList(finalPart(answer));
  return lb.length > 0 && lb.every((x) => evaluate(x) !== null);
}
