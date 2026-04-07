/**
 * DraftIndicator
 *
 * A dismissible banner shown when a form draft has been restored from localStorage.
 * Displays the relative time since the draft was saved and provides actions to
 * discard the draft or continue editing.
 *
 * Usage:
 *   const { clearDraft, hasDraft, draftSavedAt } = useFormAutoSave(form, 'patient-form');
 *
 *   {hasDraft && draftSavedAt && (
 *     <DraftIndicator
 *       savedAt={draftSavedAt}
 *       onDiscard={() => {
 *         clearDraft();
 *         form.reset();
 *       }}
 *     />
 *   )}
 */

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClockIcon, XIcon, Trash2Icon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftIndicatorProps {
  /**
   * Unix timestamp (ms) of when the draft was saved.
   * Typically comes from useFormAutoSave's draftSavedAt.
   */
  savedAt: number;
  /**
   * Called when the user clicks "Descartar".
   * The parent is responsible for calling clearDraft() and resetting the form.
   */
  onDiscard: () => void;
  /**
   * Called when the user dismisses the banner without discarding.
   * When omitted the banner can only be closed via "Descartar".
   */
  onDismiss?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraftIndicator({
  savedAt,
  onDiscard,
  onDismiss,
  className,
}: DraftIndicatorProps) {
  const [visible, setVisible] = React.useState(true);

  // Re-compute the relative time label once per minute so it stays accurate
  const [relativeTime, setRelativeTime] = React.useState<string>(() =>
    formatDistanceToNow(new Date(savedAt), { addSuffix: true, locale: ptBR }),
  );

  React.useEffect(() => {
    const update = () => {
      setRelativeTime(
        formatDistanceToNow(new Date(savedAt), { addSuffix: true, locale: ptBR }),
      );
    };

    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [savedAt]);

  const handleDismiss = React.useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const handleDiscard = React.useCallback(() => {
    setVisible(false);
    onDiscard();
  }, [onDiscard]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Rascunho restaurado"
      className={cn(
        // Layout
        'flex items-start gap-3 rounded-lg border px-4 py-3',
        // Colors — amber tone to signal "informational but attention-worthy"
        'border-amber-200 bg-amber-50 text-amber-900',
        'dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
        className,
      )}
    >
      {/* Icon */}
      <ClockIcon
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />

      {/* Message */}
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-medium">Rascunho restaurado</span>
        {' '}
        <span className="text-amber-800 dark:text-amber-300">
          de {relativeTime}.
        </span>
        {' '}
        <span className="text-amber-700 dark:text-amber-400">
          Descarte ou continue editando.
        </span>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDiscard}
          aria-label="Descartar rascunho"
          className={cn(
            'h-7 gap-1.5 px-2 text-xs',
            'text-amber-800 hover:bg-amber-100 hover:text-amber-900',
            'dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:text-amber-100',
          )}
        >
          <Trash2Icon className="h-3 w-3" aria-hidden="true" />
          Descartar
        </Button>

        {onDismiss && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            aria-label="Fechar aviso de rascunho"
            className={cn(
              'h-7 w-7',
              'text-amber-700 hover:bg-amber-100 hover:text-amber-900',
              'dark:text-amber-400 dark:hover:bg-amber-900/50 dark:hover:text-amber-100',
            )}
          >
            <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
