import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08131d] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[linear-gradient(135deg,#7ec0e5,#d8a15c)] text-[#07131d] hover:brightness-110 shadow-[0_12px_26px_rgba(126,192,229,0.18)]",
        destructive: "bg-[#f06d5b] text-white hover:bg-[#ea5c4a] shadow-[0_12px_26px_rgba(240,109,91,0.2)]",
        outline:
          "border border-white/10 bg-[#0b1623] text-slate-100 hover:bg-white/5",
        secondary:
          "bg-[#162638] text-slate-100 hover:bg-[#1d3045]",
        ghost: "text-slate-200 hover:bg-white/5 hover:text-white",
        link: "text-[#7ec0e5] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
