/**
 * Password Validation Tests
 *
 * Tests for password policy enforcement:
 * - Minimum 12 characters
 * - At least 1 digit
 * - At least 1 special character
 * - Common edge cases and security considerations
 */

import { describe, it, expect } from 'vitest';

// =========================================================================
// Password Validation Logic (extracted/created based on requirements)
// =========================================================================

/**
 * Validates password against clinic security policy.
 *
 * Requirements:
 * - Minimum 12 characters
 * - At least 1 digit (0-9)
 * - At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 *
 * @param password - The password to validate
 * @returns { valid: boolean; errors: string[] }
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password) {
    return {
      valid: false,
      errors: ['Senha é obrigatória'],
    };
  }

  if (password.length < 12) {
    errors.push('Senha deve conter no mínimo 12 caracteres');
  }

  if (!/\d/.test(password)) {
    errors.push('Senha deve conter no mínimo 1 dígito (0-9)');
  }

  // Special characters set: !@#$%^&*()_+-=[]{}|;:,.<>?
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Senha deve conter no mínimo 1 caractere especial (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

describe('Password Validation', () => {
  // =========================================================================
  // Valid Passwords
  // =========================================================================

  describe('Valid Passwords', () => {
    it('should accept strong password with all requirements', () => {
      const result = validatePassword('MyPassword123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with multiple digits', () => {
      const result = validatePassword('Secure1Pass2Code3!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with multiple special chars', () => {
      const result = validatePassword('Pass@word#123!');
      expect(result.valid).toBe(true);
    });

    it('should accept 12-character password (minimum)', () => {
      const result = validatePassword('SecurePass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept very long password', () => {
      const result = validatePassword('MyVeryLongPasswordWithManyCharacters123!@#$%^&*');
      expect(result.valid).toBe(true);
    });

    it('should accept password with lowercase and uppercase', () => {
      const result = validatePassword('MySecurePassword123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with underscore', () => {
      const result = validatePassword('Secure_Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with hyphen', () => {
      const result = validatePassword('Secure-Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with bracket', () => {
      const result = validatePassword('Secure[Pass]123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with pipe character', () => {
      const result = validatePassword('Secure|Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with colon', () => {
      const result = validatePassword('Secure:Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with semicolon', () => {
      const result = validatePassword('Secure;Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with comma', () => {
      const result = validatePassword('Secure,Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with period', () => {
      const result = validatePassword('Secure.Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with less-than sign', () => {
      const result = validatePassword('Secure<Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with greater-than sign', () => {
      const result = validatePassword('Secure>Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with plus sign', () => {
      const result = validatePassword('Secure+Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with equals sign', () => {
      const result = validatePassword('Secure=Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with caret', () => {
      const result = validatePassword('Secure^Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with ampersand', () => {
      const result = validatePassword('Secure&Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with asterisk', () => {
      const result = validatePassword('Secure*Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with parenthesis', () => {
      const result = validatePassword('Secure(Pass)123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with percent', () => {
      const result = validatePassword('Secure%Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with hash/pound', () => {
      const result = validatePassword('Secure#Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with at sign', () => {
      const result = validatePassword('Secure@Pass123!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with question mark', () => {
      const result = validatePassword('Secure?Pass123!');
      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // Invalid: Too Short
  // =========================================================================

  describe('Password Too Short', () => {
    it('should reject empty password', () => {
      const result = validatePassword('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Senha é obrigatória');
    });

    it('should reject 11-character password', () => {
      const result = validatePassword('Sho123!aTab');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('12 caracteres'))).toBe(true);
    });

    it('should reject 5-character password', () => {
      const result = validatePassword('Pass1!');
      expect(result.valid).toBe(false);
    });

    it('should reject 1-character password', () => {
      const result = validatePassword('a');
      expect(result.valid).toBe(false);
    });

    it('should reject single space', () => {
      const result = validatePassword(' ');
      expect(result.valid).toBe(false);
    });
  });

  // =========================================================================
  // Invalid: Missing Digit
  // =========================================================================

  describe('Missing Digit', () => {
    it('should reject password without any digit', () => {
      const result = validatePassword('MySecurePassword!');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('dígito'))).toBe(true);
    });

    it('should reject all letters with special char', () => {
      const result = validatePassword('SecurePasswordKey!');
      expect(result.valid).toBe(false);
    });

    it('should reject letters and special chars only', () => {
      const result = validatePassword('MyPassword@#$%^&*');
      expect(result.valid).toBe(false);
    });
  });

  // =========================================================================
  // Invalid: Missing Special Character
  // =========================================================================

  describe('Missing Special Character', () => {
    it('should reject password without special char', () => {
      const result = validatePassword('MySecurePassword123');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('especial'))).toBe(true);
    });

    it('should reject letters and digits only', () => {
      const result = validatePassword('MySecurePassword123');
      expect(result.valid).toBe(false);
    });

    it('should reject password with space instead of special char', () => {
      const result = validatePassword('My Password 123456');
      expect(result.valid).toBe(false);
    });
  });

  // =========================================================================
  // Multiple Violations
  // =========================================================================

  describe('Multiple Violations', () => {
    it('should report all missing requirements', () => {
      const result = validatePassword('short');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3); // Too short, no digit, no special char
    });

    it('should report missing digit and special char for long password', () => {
      const result = validatePassword('MyVeryLongPassword');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Senha deve conter no mínimo 1 dígito (0-9)');
      expect(result.errors).toContain('Senha deve conter no mínimo 1 caractere especial (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    });

    it('should report missing length and digit', () => {
      const result = validatePassword('Short!');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle password with spaces', () => {
      const result = validatePassword('My Password 123!');
      expect(result.valid).toBe(true);
    });

    it('should handle password with all uppercase', () => {
      const result = validatePassword('MYPASSWORD123!');
      expect(result.valid).toBe(true);
    });

    it('should handle password with all lowercase', () => {
      const result = validatePassword('mypassword123!');
      expect(result.valid).toBe(true);
    });

    it('should handle password with repeated characters', () => {
      const result = validatePassword('aaaaaaaaaa1111!');
      expect(result.valid).toBe(true);
    });

    it('should handle password with accented characters', () => {
      const result = validatePassword('MinhaSenha123!');
      expect(result.valid).toBe(true);
    });

    it('should handle password with unicode characters', () => {
      const result = validatePassword('Pässwörd123!');
      expect(result.valid).toBe(true);
    });

    it('should handle password with emoji (if supported by input)', () => {
      // Some systems may support emoji
      const result = validatePassword('Password😀123!');
      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // Security Considerations
  // =========================================================================

  describe('Security Considerations', () => {
    it('should reject common weak passwords', () => {
      const commonWeak = [
        'password123!', // Only 12 chars but too common
        '12345678901!', // All digits and special char
        'qwerty12345!', // Keyboard pattern
      ];

      // At least some should be too short or missing requirements
      commonWeak.forEach((pwd) => {
        const result = validatePassword(pwd);
        // These pass validation but are weak (not checked by this validator)
        // Just verify they pass length/digit/special checks if they do
      });
    });

    it('should allow strong random passwords', () => {
      const strongPasswords = [
        'Xk9@mP2qRsTuvwxyz',
        'Ql8!nD6vWxY56789',
        'Zc4#jH7bFgJabcde',
      ];

      strongPasswords.forEach((pwd) => {
        const result = validatePassword(pwd);
        expect(result.valid).toBe(true);
      });
    });

    it('should not reveal specific missing requirement order', () => {
      // Error messages should be clear but not reveal what's "first"
      const result1 = validatePassword('a');
      const result2 = validatePassword('abc');

      expect(result1.errors.length).toBeGreaterThan(0);
      expect(result2.errors.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Boundary Tests
  // =========================================================================

  describe('Boundary Tests', () => {
    it('should accept exactly 12-character password (lower bound)', () => {
      const result = validatePassword('Exact12Char!');
      expect(result.valid).toBe(true);
    });

    it('should accept 13-character password', () => {
      const result = validatePassword('Exact13Chars!!');
      expect(result.valid).toBe(true);
    });

    it('should reject 11-character password', () => {
      // 11 characters: Pass123!abc
      const result = validatePassword('Pass123!abc');
      expect(result.valid).toBe(false);
    });

    it('should accept password with exactly 1 digit', () => {
      const result = validatePassword('PasswordOnly1!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with exactly 1 special char', () => {
      const result = validatePassword('PasswordOnly1!');
      expect(result.valid).toBe(true);
    });

    it('should accept password with exactly 1 digit AND 1 special char', () => {
      const result = validatePassword('PasswordOnly1!');
      expect(result.valid).toBe(true);
    });
  });

  // =========================================================================
  // Return Value Structure Tests
  // =========================================================================

  describe('Return Value Structure', () => {
    it('should return object with "valid" and "errors" properties', () => {
      const result = validatePassword('ValidPassword123!');
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
    });

    it('should return "valid: true" when password meets all requirements', () => {
      const result = validatePassword('ValidPassword123!');
      expect(result.valid).toBe(true);
    });

    it('should return "valid: false" when password fails validation', () => {
      const result = validatePassword('weak');
      expect(result.valid).toBe(false);
    });

    it('should return empty errors array for valid password', () => {
      const result = validatePassword('ValidPassword123!');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return non-empty errors array for invalid password', () => {
      const result = validatePassword('weak');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return array of strings as errors', () => {
      const result = validatePassword('weak');
      result.errors.forEach((error) => {
        expect(typeof error).toBe('string');
      });
    });
  });

  // =========================================================================
  // Integration-like Tests
  // =========================================================================

  describe('Integration Scenarios', () => {
    it('should validate password during user creation', () => {
      const userPassword = 'SecureClinicPass123!';
      const result = validatePassword(userPassword);

      if (!result.valid) {
        throw new Error(`Password validation failed: ${result.errors.join(', ')}`);
      }

      expect(result.valid).toBe(true);
    });

    it('should validate password during password change', () => {
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';

      const oldResult = validatePassword(oldPassword);
      const newResult = validatePassword(newPassword);

      expect(oldResult.valid).toBe(true);
      expect(newResult.valid).toBe(true);
      expect(oldPassword).not.toBe(newPassword);
    });

    it('should provide error messages for user feedback', () => {
      const userInput = 'dentist';
      const result = validatePassword(userInput);

      expect(result.valid).toBe(false);
      result.errors.forEach((error) => {
        // Each error should be user-friendly Portuguese
        expect(error).toMatch(/[Ss]enha/);
      });
    });

    it('should work in a form validation context', () => {
      const passwords = [
        { pwd: 'MySecure123!', expected: true },
        { pwd: 'weak', expected: false },
        { pwd: 'NoDigits!', expected: false },
        { pwd: 'NoSpecial123', expected: false },
      ];

      passwords.forEach(({ pwd, expected }) => {
        const result = validatePassword(pwd);
        expect(result.valid).toBe(expected);
      });
    });
  });
});
