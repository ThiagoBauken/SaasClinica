/**
 * Test Setup - runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dental:dental123@localhost:5432/dental_clinic_test';

// Silence logs during tests
process.env.LOG_LEVEL = 'silent';
