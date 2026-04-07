/**
 * CPF validation, formatting, and masking utilities.
 *
 * All functions are isomorphic and work in both Node.js and browser environments.
 * No external dependencies are required.
 *
 * @module shared/validators/cpf
 */

/**
 * A set of all-same-digit CPFs that are structurally valid (11 digits) but
 * semantically invalid by Receita Federal rules.
 */
const ALL_SAME_DIGITS = new Set([
  "00000000000",
  "11111111111",
  "22222222222",
  "33333333333",
  "44444444444",
  "55555555555",
  "66666666666",
  "77777777777",
  "88888888888",
  "99999999999",
]);

/**
 * Removes all non-digit characters from a CPF string.
 *
 * @param cpf - The raw CPF string, possibly with formatting characters.
 * @returns A string containing only the digit characters.
 *
 * @example
 * stripCPF("123.456.789-09") // "12345678909"
 */
export function stripCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/**
 * Validates a CPF using the two-step modulo-11 algorithm specified by
 * the Brazilian Receita Federal.
 *
 * The function accepts CPFs with or without formatting characters (dots and
 * dashes). It returns false for any of the following conditions:
 * - The stripped value is not exactly 11 digits.
 * - The CPF consists of all identical digits (e.g., "111.111.111-11").
 * - Either verification digit fails the modulo-11 check.
 *
 * @param cpf - The CPF string to validate.
 * @returns `true` if the CPF is valid, `false` otherwise.
 *
 * @example
 * validateCPF("529.982.247-25") // true
 * validateCPF("111.111.111-11") // false (all same digits)
 * validateCPF("529.982.247-26") // false (wrong check digit)
 */
export function validateCPF(cpf: string): boolean {
  const digits = stripCPF(cpf);

  if (digits.length !== 11) {
    return false;
  }

  if (ALL_SAME_DIGITS.has(digits)) {
    return false;
  }

  /**
   * Computes a single CPF verification digit using the modulo-11 algorithm.
   *
   * @param base - The digit sequence to compute against (9 or 10 digits).
   * @param weight - The starting weight for the sum (10 for first digit, 11 for second).
   */
  function computeVerificationDigit(base: string, weight: number): number {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * (weight - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  }

  const firstDigit = computeVerificationDigit(digits.slice(0, 9), 10);
  if (firstDigit !== parseInt(digits[9], 10)) {
    return false;
  }

  const secondDigit = computeVerificationDigit(digits.slice(0, 10), 11);
  if (secondDigit !== parseInt(digits[10], 10)) {
    return false;
  }

  return true;
}

/**
 * Formats a raw digit string or loosely formatted CPF into the canonical
 * Brazilian display format: XXX.XXX.XXX-XX.
 *
 * The function does not validate the CPF. If the stripped input does not
 * contain exactly 11 digits, the raw stripped string is returned unchanged.
 *
 * @param cpf - The CPF string to format.
 * @returns The formatted CPF string, or the stripped input if it is not 11 digits.
 *
 * @example
 * formatCPF("52998224725")    // "529.982.247-25"
 * formatCPF("529.982.247-25") // "529.982.247-25"
 */
export function formatCPF(cpf: string): string {
  const digits = stripCPF(cpf);

  if (digits.length !== 11) {
    return digits;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Returns a partially masked CPF suitable for secure display, hiding the
 * first two groups of digits while revealing the third group and the
 * verification digits.
 *
 * Output format: ***.***.XXX-XX
 *
 * The function does not validate the CPF. If the stripped input does not
 * contain exactly 11 digits, the raw stripped string is returned unchanged.
 *
 * @param cpf - The CPF string to mask.
 * @returns The masked CPF string, or the stripped input if it is not 11 digits.
 *
 * @example
 * maskCPF("529.982.247-25") // "***.982.247-25" (wait — spec says ***.***.XXX-XX)
 * maskCPF("52998224725")    // "***.***.247-25"
 */
export function maskCPF(cpf: string): string {
  const digits = stripCPF(cpf);

  if (digits.length !== 11) {
    return digits;
  }

  // Format: ***.***.XXX-XX — first two groups are masked, third group and
  // verification digits are shown in plain text.
  return `***.***.${ digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}
