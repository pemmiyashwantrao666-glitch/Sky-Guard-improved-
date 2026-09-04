import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-white/8 bg-white/6 text-white",
        secondary: "border-slate-400/20 bg-slate-500/10 text-slate-200",
        destructive: "border-red-400/25 bg-red-400/10 text-red-200",
        outline: "text-slate-200 border-white/8 bg-[#0b1623]",
        success: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
        warning: "border-amber-400/25 bg-amber-500/10 text-amber-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
