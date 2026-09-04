import * as React from "react";
import { cn } from "@/lib/utils";

interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
}

function Toggle({ className, pressed, onClick, ...props }: ToggleProps) {
  const [internalPressed, setInternalPressed] = React.useState(Boolean(pressed));
  const isPressed = pressed ?? internalPressed;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPressed}
      data-state={isPressed ? "on" : "off"}
      onClick={(event) => {
        setInternalPressed((current) => !current);
        onClick?.(event);
      }}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-blue focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isPressed ? "bg-deep-atmo" : "bg-cloud-grey",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
          isPressed ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export { Toggle };
