/**
 * Brazilian phone number validation, formatting, and stripping utilities.
 *
 * Supports both landline numbers (10 digits, format (XX) XXXX-XXXX) and mobile
 * numbers (11 digits, format (XX) XXXXX-XXXX). All functions are isomorphic
 * and work in both Node.js and browser environments.
 *
 * No external dependencies are required.
 *
 * @module shared/validators/phone
 */

/**
 * Removes all non-digit characters from a phone string.
 *
 * @param phone - The raw phone string, possibly with formatting characters.
 * @returns A string containing only the digit characters.
 *
 * @example
 * stripPhone("(11) 98765-4321") // "11987654321"
 * stripPhone("+55 (11) 98765-4321") // "5511987654321"
 */
export function stripPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Validates a Brazilian phone number.
 *
 * Accepts numbers with or without the country code prefix (+55 or 55).
 * After stripping the country code, the local number must be exactly 10 digits
 * (landline) or 11 digits (mobile).
 *
 * Additional rules enforced:
 * - The DDD (area code) must be a valid two-digit Brazilian area code (11–99).
 * - Mobile numbers (11 digits) must have their 3rd digit equal to 9.
 * - Landline numbers (10 digits) must have their 3rd digit between 2 and 8.
 *
 * @param phone - The phone string to validate.
 * @returns `true` if the phone number is valid, `false` otherwise.
 *
 * @example
 * validateBrazilianPhone("(11) 98765-4321") // true  — mobile
 * validateBrazilianPhone("(11) 3456-7890")  // true  — landline
 * validateBrazilianPhone("11987654321")     // true  — mobile, no formatting
 * validateBrazilianPhone("1112345678")      // true  — landline, no formatting
 * validateBrazilianPhone("(00) 98765-4321") // false — invalid DDD
 * validateBrazilianPhone("(11) 18765-4321") // false — mobile does not start with 9
 */
export function validateBrazilianPhone(phone: string): boolean {
  let digits = stripPhone(phone);

  // Strip country code if present (either "55" prefix making total 12/13 digits)
  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith("55")) {
      digits = digits.slice(2);
    }
  }

  if (digits.length !== 10 && digits.length !== 11) {
    return false;
  }

  // DDD must be between 11 and 99.
  // Valid Brazilian DDDs start from 11; 00-10 are not assigned.
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) {
    return false;
  }

  const thirdDigit = parseInt(digits[2], 10);

  if (digits.length === 11) {
    // Mobile numbers must have 9 as the first digit of the subscriber number.
    if (thirdDigit !== 9) {
      return false;
    }
  } else {
    // Landline numbers: first digit of subscriber number must be 2–8.
    if (thirdDigit < 2 || thirdDigit > 8) {
      return false;
    }
  }

  return true;
}

/**
 * Formats a raw digit string or loosely formatted phone number into the
 * canonical Brazilian display format.
 *
 * - 11-digit numbers (mobile): (XX) XXXXX-XXXX
 * - 10-digit numbers (landline): (XX) XXXX-XXXX
 *
 * If the stripped input has a "55" country code prefix (12 or 13 digits total),
 * the prefix is stripped before formatting.
 *
 * The function does not validate the phone number. If the stripped input does
 * not match a supported length, the raw stripped string is returned unchanged.
 *
 * @param phone - The phone string to format.
 * @returns The formatted phone string, or the stripped input if the length is unsupported.
 *
 * @example
 * formatPhone("11987654321")     // "(11) 98765-4321"
 * formatPhone("1134567890")      // "(11) 3456-7890"
 * formatPhone("+55 11 98765-4321") // "(11) 98765-4321"
 */
export function formatPhone(phone: string): string {
  let digits = stripPhone(phone);

  // Strip country code if present.
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    // Mobile: (XX) XXXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }

  if (digits.length === 10) {
    // Landline: (XX) XXXX-XXXX
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  // Unsupported length — return as-is (stripped of non-digits).
  return digits;
}
