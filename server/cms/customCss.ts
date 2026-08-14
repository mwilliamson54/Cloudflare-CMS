export const CUSTOM_CSS_MAX_LENGTH = 12_000;

const FORBIDDEN_CSS = [
  { pattern: /@import\b/i, label: "@import" },
  { pattern: /url\s*\(/i, label: "url()" },
  { pattern: /expression\s*\(/i, label: "expression()" },
  { pattern: /behavior\s*:/i, label: "behavior" },
  { pattern: /-moz-binding\b/i, label: "-moz-binding" },
  { pattern: /javascript\s*:/i, label: "javascript:" },
  { pattern: /<\/?(?:style|script)\b/i, label: "HTML markup" },
] as const;

/** Returns a human-readable reason when an administrator CSS payload is unsafe. */
export function getCustomCssValidationError(value: string): string | null {
  if (value.length > CUSTOM_CSS_MAX_LENGTH) return `Custom CSS must be at most ${CUSTOM_CSS_MAX_LENGTH.toLocaleString()} characters.`;
  const forbidden = FORBIDDEN_CSS.find(rule => rule.pattern.test(value));
  return forbidden ? `Custom CSS cannot contain ${forbidden.label}.` : null;
}
