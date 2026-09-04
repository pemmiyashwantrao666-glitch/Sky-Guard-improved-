import * as React from "react";
import { cn } from "@/lib/utils";

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

function Collapsible({ open, onOpenChange, children, className }: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(open ?? false);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  return (
    <div className={cn("w-full", className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ onToggle?: () => void; isOpen?: boolean }>, {
            onToggle: handleToggle,
            isOpen: open ?? isOpen,
          });
        }
        return child;
      })}
    </div>
  );
}

interface CollapsibleTriggerProps {
  onToggle?: () => void;
  isOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}

function CollapsibleTrigger({ onToggle, isOpen, children, className }: CollapsibleTriggerProps) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className={cn("flex w-full items-center", className)}
    >
      {children}
    </button>
  );
}

interface CollapsibleContentProps {
  isOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

function CollapsibleContent({ isOpen, children, className }: CollapsibleContentProps) {
  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-200",
        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
