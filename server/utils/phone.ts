/**
 * Shared phone normalization utility.
 * Ensures consistent phone format across the entire application.
 * All phones stored/compared as digits-only with country code 55.
 */

/**
 * Normalizes a phone number to digits-only format with Brazilian country code.
 * Strips all non-digit characters, prepends 55 if missing.
 *
 * @example
 *   normalizePhone("+55 (11) 99999-9999") => "5511999999999"
 *   normalizePhone("11999999999")          => "5511999999999"
 *   normalizePhone("5511999999999")        => "5511999999999"
 *   normalizePhone("5511999999999@s.whatsapp.net") => "5511999999999"
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove WhatsApp suffix if present
  const cleaned = phone.replace(/@s\.whatsapp\.net$/i, '');
  // Keep only digits
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  // Already has country code
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  // Add country code for Brazilian numbers (10-11 digits)
  if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
  return digits;
}

/**
 * Checks if two phone numbers refer to the same person.
 * Normalizes both before comparing.
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  if (!n1 || !n2) return false;
  return n1 === n2;
}
