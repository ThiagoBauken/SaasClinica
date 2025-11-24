import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Middleware genérico de validação usando Zod
 * Valida body, query, e params da requisição
 */
export function validate(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Valida body se schema fornecido
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }

      // Valida query parameters se schema fornecido
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }

      // Valida route parameters se schema fornecido
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
          })),
        });
      }

      // Erro inesperado
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        error: 'Internal server error during validation',
      });
    }
  };
}

/**
 * Schema comum para paginação
 */
export const paginationSchema = z.object({
  page: z.string().optional().default('1').transform(val => {
    const num = parseInt(val, 10);
    return isNaN(num) || num < 1 ? 1 : num;
  }),
  limit: z.string().optional().default('50').transform(val => {
    const num = parseInt(val, 10);
    // Limita entre 1 e 100 registros por página
    return isNaN(num) || num < 1 ? 50 : Math.min(num, 100);
  }),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * Schema comum para IDs numéricos em params
 */
export const idParamSchema = z.object({
  id: z.string().transform((val, ctx) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ID must be a positive integer',
      });
      return z.NEVER;
    }
    return num;
  }),
});

/**
 * Schema comum para filtros de data
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  {
    message: 'startDate must be before or equal to endDate',
    path: ['startDate'],
  }
);

/**
 * Helper para criar resposta paginada padronizada
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Helper para calcular offset para queries SQL
 */
export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}
