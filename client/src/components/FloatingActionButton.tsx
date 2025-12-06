import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onClick: () => void;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  variant?: "default" | "primary" | "success";
  size?: "default" | "lg";
  showOnMobile?: boolean;
}

export default function FloatingActionButton({
  onClick,
  label = "Novo",
  icon,
  className,
  variant = "primary",
  size = "lg",
  showOnMobile = true,
}: FloatingActionButtonProps) {
  const variantStyles = {
    default: "bg-primary hover:bg-primary/90",
    primary: "bg-blue-600 hover:bg-blue-700",
    success: "bg-green-600 hover:bg-green-700",
  };

  const sizeStyles = {
    default: "h-14 w-14",
    lg: "h-16 w-16",
  };

  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-50 shadow-lg transition-all duration-300 hover:shadow-xl active:scale-95",
        variantStyles[variant],
        sizeStyles[size],
        "rounded-full",
        showOnMobile ? "flex" : "hidden md:flex",
        "items-center justify-center gap-2 text-white",
        // Adicionar padding quando houver label
        label && "px-6 w-auto",
        className
      )}
      size="icon"
      aria-label={label}
    >
      {icon || <Plus className="h-6 w-6" />}
      {label && <span className="font-medium whitespace-nowrap">{label}</span>}
    </Button>
  );
}

// Variante expandida com menu de ações
interface FABWithMenuProps {
  actions: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "primary" | "success" | "danger";
  }>;
  mainLabel?: string;
  mainIcon?: React.ReactNode;
}

export function FABWithMenu({ actions, mainLabel = "Criar", mainIcon }: FABWithMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const variantStyles = {
    default: "bg-muted-foreground hover:bg-muted-foreground/90",
    primary: "bg-blue-600 hover:bg-blue-700",
    success: "bg-green-600 hover:bg-green-700",
    danger: "bg-red-600 hover:bg-red-700",
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action Buttons */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-3">
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={() => {
                action.onClick();
                setIsOpen(false);
              }}
              className={cn(
                "shadow-lg transition-all duration-300 hover:shadow-xl",
                variantStyles[action.variant || "primary"],
                "rounded-full h-12 px-4 flex items-center gap-2 text-white",
                "animate-in slide-in-from-bottom-5 fade-in"
              )}
              style={{
                animationDelay: `${index * 50}ms`,
                animationFillMode: "backwards",
              }}
            >
              {action.icon}
              <span className="font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-16 w-16 shadow-lg transition-all duration-300 hover:shadow-xl",
          "bg-primary hover:bg-primary/90 rounded-full text-white",
          isOpen && "rotate-45"
        )}
        size="icon"
      >
        {mainIcon || <Plus className="h-6 w-6" />}
      </Button>
    </>
  );
}

// Export do namespace React para FABWithMenu
import * as React from "react";
