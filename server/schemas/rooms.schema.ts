import { z } from 'zod';

/**
 * Schema para criação de sala
 */
export const createRoomSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  description: z.string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres')
    .optional()
    .nullable(),
  active: z.boolean()
    .optional()
    .default(true),
});

/**
 * Schema para atualização de sala
 */
export const updateRoomSchema = createRoomSchema.partial();

/**
 * Schema para filtros de busca de salas
 */
export const searchRoomsSchema = z.object({
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
