import { z } from 'zod';

/**
 * Schema para criação de procedimento
 */
export const createProcedureSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  description: z.string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres')
    .optional()
    .nullable(),
  duration: z.number()
    .int('Duração deve ser um número inteiro')
    .positive('Duração deve ser positiva')
    .max(480, 'Duração máxima é 480 minutos (8 horas)'),
  price: z.number()
    .int('Preço deve ser um número inteiro (em centavos)')
    .min(0, 'Preço não pode ser negativo'),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um código hexadecimal válido (#RRGGBB)')
    .optional()
    .nullable(),
  active: z.boolean()
    .optional()
    .default(true),
});

/**
 * Schema para atualização de procedimento
 */
export const updateProcedureSchema = createProcedureSchema.partial();

/**
 * Schema para filtros de busca de procedimentos
 */
export const searchProceduresSchema = z.object({
  active: z.enum(['true', 'false', 'all'])
    .optional()
    .default('all')
    .transform(val => {
      if (val === 'all') return undefined;
      return val === 'true';
    }),
  search: z.string()
    .max(100)
    .optional()
    .transform(val => val?.trim()),
});
