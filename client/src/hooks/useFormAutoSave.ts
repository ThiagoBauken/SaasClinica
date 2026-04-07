/**
 * useFormAutoSave
 *
 * Persists react-hook-form values to localStorage with debounce, restores
 * drafts on mount, warns before unload when the form is dirty, and exposes
 * clearDraft / hasDraft helpers.
 *
 * Usage:
 *   const form = useForm<PatientFormValues>({ ... });
 *   const { clearDraft, hasDraft } = useFormAutoSave(form, 'patient-form');
 *
 *   // After a successful submit:
 *   clearDraft();
 *
 *   // Show a restore banner when hasDraft is true (see DraftIndicator).
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { UseFormReturn, FieldValues } from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseFormAutoSaveOptions {
  /** Milliseconds to wait after the last change before writing to storage. Default: 3000. */
  debounceMs?: number;
  /** Maximum age of a saved draft in milliseconds before it is discarded. Default: 86400000 (24 h). */
  maxAge?: number;
  /** Whether to show a toast notification when a draft is restored. Default: true. */
  showToast?: boolean;
}

interface DraftPayload<T> {
  values: T;
  savedAt: number;
}

export interface UseFormAutoSaveReturn {
  /** Removes the draft from localStorage. Call this after a successful form submit. */
  clearDraft: () => void;
  /**
   * True when a draft exists in localStorage for the given key.
   * Useful for rendering the DraftIndicator banner.
   */
  hasDraft: boolean;
  /**
   * Unix timestamp (ms) of when the current draft was last saved.
   * Undefined when hasDraft is false.
   */
  draftSavedAt: number | undefined;
}

// ---------------------------------------------------------------------------
// Storage helpers — all wrapped in try/catch for private-browsing or quota errors
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'form-draft:';

function readDraft<T>(key: string): DraftPayload<T> | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as DraftPayload<T>;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, values: T): boolean {
  try {
    const payload: DraftPayload<T> = { values, savedAt: Date.now() };
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(payload));
    return true;
  } catch {
    // Storage full or access denied (private browsing)
    return false;
  }
}

function removeDraft(key: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // Silently ignore — nothing critical to surface here
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFormAutoSave<T extends FieldValues>(
  form: UseFormReturn<T>,
  key: string,
  options?: UseFormAutoSaveOptions,
): UseFormAutoSaveReturn {
  const {
    debounceMs = 3000,
    maxAge = 86_400_000, // 24 hours
    showToast = true,
  } = options ?? {};

  const { toast } = useToast();

  // Track whether a draft is currently in storage
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    const existing = readDraft<T>(key);
    if (!existing) return false;
    return Date.now() - existing.savedAt < maxAge;
  });

  const [draftSavedAt, setDraftSavedAt] = useState<number | undefined>(() => {
    const existing = readDraft<T>(key);
    if (!existing) return undefined;
    if (Date.now() - existing.savedAt >= maxAge) return undefined;
    return existing.savedAt;
  });

  // Hold a ref to the debounce timer so we can clear it on unmount
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a stable ref to the current key to avoid stale closures in effects
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  // ------------------------------------------------------------------
  // 1. Restore draft on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    const draft = readDraft<T>(key);

    if (!draft) return;

    const age = Date.now() - draft.savedAt;
    if (age >= maxAge) {
      // Draft is too old — discard it silently
      removeDraft(key);
      setHasDraft(false);
      setDraftSavedAt(undefined);
      return;
    }

    // Restore values without triggering validation
    form.reset(draft.values, {
      keepErrors: false,
      keepDirty: false,
      keepDirtyValues: false,
      keepDefaultValues: true,
      keepIsSubmitted: false,
      keepTouched: false,
      keepIsValid: false,
    });

    setHasDraft(true);
    setDraftSavedAt(draft.savedAt);

    if (showToast) {
      toast({
        title: 'Rascunho restaurado automaticamente',
        description: 'Suas alteracoes nao salvas foram recuperadas.',
      });
    }
    // Intentionally run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // 2. Watch form values and write to storage (debounced)
  // ------------------------------------------------------------------
  useEffect(() => {
    const subscription = form.watch((values) => {
      // Clear any pending save
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        const saved = writeDraft<Partial<T>>(keyRef.current, values as Partial<T>);
        if (saved) {
          const now = Date.now();
          setHasDraft(true);
          setDraftSavedAt(now);
        }
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [form, debounceMs]);

  // ------------------------------------------------------------------
  // 3. Warn before unload when form is dirty
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        // Modern browsers ignore custom messages but require preventDefault + returnValue
        event.preventDefault();
        // eslint-disable-next-line no-param-reassign
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [form.formState.isDirty]);

  // ------------------------------------------------------------------
  // 4. clearDraft — stable reference via useCallback
  // ------------------------------------------------------------------
  const clearDraft = useCallback(() => {
    removeDraft(keyRef.current);
    setHasDraft(false);
    setDraftSavedAt(undefined);

    // Cancel any pending debounced write
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, []);

  return { clearDraft, hasDraft, draftSavedAt };
}
