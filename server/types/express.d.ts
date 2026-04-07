/**
 * Express type augmentation for authenticated requests.
 * Eliminates `req.user as any` pattern across 400+ route handlers.
 *
 * The User type is unified with the full Drizzle SelectUser type from
 * @shared/schema so that all columns (including croNumber, specialties,
 * professionalCouncil, etc.) are available on req.user without casts.
 */

import type { User as SelectUser } from '@shared/schema';

export type AuthenticatedUser = SelectUser;

declare global {
  namespace Express {
    // Augment Passport's User type with the full Drizzle row type
    interface User extends SelectUser {}
  }
}
