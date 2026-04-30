import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Texto que o usuário precisa digitar para confirmar (ex: "EXCLUIR"). Omita para confirmação simples. */
  requireText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  requireText,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const matches = !requireText || typed === requireText;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle
            className={
              variant === "destructive"
                ? "flex items-center gap-2 text-destructive"
                : "flex items-center gap-2"
            }
          >
            {variant === "destructive" && <AlertTriangle className="h-5 w-5" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {requireText && (
          <div className="py-2 space-y-2">
            <Label htmlFor="confirm-text">
              Digite <strong>{requireText}</strong> para confirmar
            </Label>
            <Input
              id="confirm-text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireText}
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={() => onConfirm()}
            disabled={!matches || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
