/**
 * Environment Variables Validation
 * Validates required environment variables on startup
 */

interface EnvConfig {
  name: string;
  required: boolean;
  defaultValue?: string;
  validate?: (value: string) => boolean;
  errorMessage?: string;
}

const envConfigs: EnvConfig[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    errorMessage: 'DATABASE_URL is required for PostgreSQL connection',
  },

  // Session
  {
    name: 'SESSION_SECRET',
    required: process.env.NODE_ENV === 'production',
    validate: (value) => value.length >= 32,
    errorMessage: 'SESSION_SECRET must be at least 32 characters in production',
  },

  // Stripe (required for payments)
  {
    name: 'STRIPE_SECRET_KEY',
    required: false, // Optional, but warn if missing
    validate: (value) => value.startsWith('sk_'),
    errorMessage: 'STRIPE_SECRET_KEY should start with sk_',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    validate: (value) => value.startsWith('whsec_'),
    errorMessage: 'STRIPE_WEBHOOK_SECRET should start with whsec_',
  },

  // Google OAuth (required for Google Calendar integration)
  {
    name: 'GOOGLE_CLIENT_ID',
    required: false,
    errorMessage: 'GOOGLE_CLIENT_ID is required for Google OAuth',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: false,
    errorMessage: 'GOOGLE_CLIENT_SECRET is required for Google OAuth',
  },

  // Base URL (required for OAuth callbacks)
  {
    name: 'BASE_URL',
    required: process.env.NODE_ENV === 'production',
    validate: (value) => value.startsWith('http'),
    errorMessage: 'BASE_URL must be a valid URL starting with http(s)',
  },

  // Redis (optional but recommended for production)
  {
    name: 'REDIS_URL',
    required: false,
    errorMessage: 'REDIS_URL is recommended for session storage in production',
  },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const config of envConfigs) {
    const value = process.env[config.name];

    // Check if required
    if (config.required && !value) {
      errors.push(`Missing required env var: ${config.name}. ${config.errorMessage || ''}`);
      continue;
    }

    // If not required but missing, add warning
    if (!config.required && !value) {
      if (config.name === 'STRIPE_SECRET_KEY' ||
          config.name === 'GOOGLE_CLIENT_ID' ||
          config.name === 'REDIS_URL') {
        warnings.push(`Optional env var not set: ${config.name}. ${config.errorMessage || ''}`);
      }
      continue;
    }

    // Validate format if validator provided
    if (value && config.validate && !config.validate(value)) {
      if (config.required) {
        errors.push(`Invalid format for ${config.name}. ${config.errorMessage || ''}`);
      } else {
        warnings.push(`Invalid format for ${config.name}. ${config.errorMessage || ''}`);
      }
    }
  }

  // Check for localhost in production
  if (process.env.NODE_ENV === 'production') {
    const baseUrl = process.env.BASE_URL || '';
    const googleCallback = process.env.GOOGLE_CALLBACK_URL || '';

    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      errors.push('BASE_URL contains localhost in production mode');
    }

    if (googleCallback.includes('localhost') || googleCallback.includes('127.0.0.1')) {
      warnings.push('GOOGLE_CALLBACK_URL contains localhost in production mode');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function logValidationResult(result: ValidationResult): void {
  if (result.warnings.length > 0) {
    console.log('\n⚠️  Environment Warnings:');
    result.warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (result.errors.length > 0) {
    console.log('\n❌ Environment Errors:');
    result.errors.forEach(e => console.log(`   - ${e}`));
  }

  if (result.valid && result.warnings.length === 0) {
    console.log('✅ Environment configuration validated successfully');
  }
}

export function validateEnvOrExit(): void {
  const result = validateEnv();
  logValidationResult(result);

  if (!result.valid && process.env.NODE_ENV === 'production') {
    console.error('\n💥 Cannot start in production with invalid configuration. Exiting...\n');
    process.exit(1);
  }
}
