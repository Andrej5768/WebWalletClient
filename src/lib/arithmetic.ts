/**
 * Arithmetic in an amount field: `1200*0.8`, `350+120`, `1200-15%`. Percent is relative to what it is applied to:
 * `a + b%` and `a - b%` add or take a share of a, `a * b%` is a share of a, a lone `15%` is 0.15. Spaces are ignored
 * and a comma is a decimal point, as in the Ukrainian locale.
 */

interface Part {
  value: number;
  /** The part ends with %, so it is applied to its neighbour. */
  percent: boolean;
}

class Parser {
  private pos = 0;

  constructor(private readonly text: string) {}

  parse(): number | null {
    const result = this.expression();
    if (result === null || this.pos !== this.text.length) return null;
    return result.percent ? result.value / 100 : result.value;
  }

  private expression(): Part | null {
    let left = this.term();
    if (left === null) return null;
    while (this.peek() === '+' || this.peek() === '-') {
      const sign = this.next() === '+' ? 1 : -1;
      const right = this.term();
      if (right === null) return null;
      const base: number = left.percent ? left.value / 100 : left.value;
      left = {
        value: right.percent ? base * (1 + (sign * right.value) / 100) : base + sign * right.value,
        percent: false,
      };
    }
    return left;
  }

  private term(): Part | null {
    let left = this.factor();
    if (left === null) return null;
    while (this.peek() === '*' || this.peek() === '/') {
      const multiply = this.next() === '*';
      const right = this.factor();
      if (right === null) return null;
      const base: number = left.percent ? left.value / 100 : left.value;
      const other = right.percent ? right.value / 100 : right.value;
      if (!multiply && other === 0) return null;
      left = { value: multiply ? base * other : base / other, percent: false };
    }
    return left;
  }

  private factor(): Part | null {
    let sign = 1;
    while (this.peek() === '-' || this.peek() === '+') {
      if (this.next() === '-') sign = -sign;
    }
    let part: Part | null;
    if (this.peek() === '(') {
      this.next();
      part = this.expression();
      if (part === null || this.next() !== ')') return null;
      if (part.percent) part = { value: part.value / 100, percent: false };
    } else {
      part = this.number();
    }
    if (part === null) return null;
    if (this.peek() === '%') {
      this.next();
      part = { value: part.value, percent: true };
    }
    return { value: sign * part.value, percent: part.percent };
  }

  private number(): Part | null {
    const match = /^\d+(?:\.\d+)?|^\.\d+/.exec(this.text.slice(this.pos));
    if (!match) return null;
    this.pos += match[0].length;
    return { value: Number(match[0]), percent: false };
  }

  private peek(): string {
    return this.text[this.pos] ?? '';
  }

  private next(): string {
    return this.text[this.pos++] ?? '';
  }
}

const normalize = (text: string) =>
  text.replace(/\s/g, '').replace(/,/g, '.').replace(/[×x]/g, '*').replace(/÷/g, '/');

/** Whether the text is more than a plain number: it has an operator, a percent or parentheses. */
export function isExpression(text: string): boolean {
  return /[-+*/%()×x÷]/.test(normalize(text).replace(/^-/, ''));
}

/** The value of the text, rounded to the cents; null when it is empty or not a complete expression. */
export function evaluate(text: string): number | null {
  const normalized = normalize(text);
  if (normalized === '') return null;
  const value = new Parser(normalized).parse();
  return value === null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100;
}
