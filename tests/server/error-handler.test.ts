/**
 * Error Handler Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  globalErrorHandler,
} from '../../server/middleware/errorHandler';

describe('Error Handler', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      originalUrl: '/api/test',
      ip: '127.0.0.1',
      user: { id: 1, companyId: 1 },
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('Custom Errors', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.isOperational).toBe(true);
    });

    it('should create NotFoundError', () => {
      const error = new NotFoundError('Patient');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Patient not found');
    });

    it('should create UnauthorizedError', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create ForbiddenError', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create ValidationError with details', () => {
      const details = [{ field: 'email', message: 'Invalid email' }];
      const error = new ValidationError('Validation failed', details);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should create ConflictError', () => {
      const error = new ConflictError('Email already in use');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('Global Error Handler', () => {
    it('should handle AppError correctly', () => {
      const error = new NotFoundError('Patient');

      globalErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.code).toBe('NOT_FOUND');
      expect(response.error.message).toBe('Patient not found');
      expect(response.timestamp).toBeDefined();
    });

    it('should handle ValidationError with details', () => {
      const error = new ValidationError('Bad input', [{ field: 'name' }]);

      globalErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.details).toBeDefined();
    });

    it('should handle generic errors as 500', () => {
      const error = new Error('Something broke');

      globalErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should hide error details in production for 500 errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Database connection failed');

      globalErrorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.message).not.toContain('Database');
      expect(response.error.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should show error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Debug info visible');

      globalErrorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });
  });
});
