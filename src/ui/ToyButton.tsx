import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const toyButton = cva(
  [
    "inline-flex items-center justify-center gap-2 border-[3px] border-ink font-display",
    "text-ink select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-hot focus-visible:ring-offset-2 focus-visible:ring-offset-meadow-deep",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary: "toy-press bg-ochre-hot",
        secondary: "toy-press bg-cream",
        ghost: "toy-press bg-parchment",
        quiet:
          "border-0 bg-transparent font-sans font-bold text-cream drop-shadow-[2px_2px_0_#1c1710] transition-colors duration-150 hover:text-parchment",
      },
      size: {
        sm: "min-h-11 rounded-btn px-3 py-2 text-sm",
        md: "min-h-11 rounded-btn px-4 py-2 text-base",
        lg: "min-h-12 rounded-[14px] px-6 py-3 text-2xl",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof toyButton> & {
    asChild?: boolean;
  };

export function ToyButton({ className, variant, size, asChild, ...props }: Props) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(toyButton({ variant, size }), className)} {...props} />;
}

export function ToyTray({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("toy-shadow flex gap-1 rounded-[16px] border-[3px] border-ink bg-cream p-1", className)}>
      {children}
    </div>
  );
}

export function ToyPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("toy-shadow overflow-hidden rounded-[16px] border-[3px] border-ink bg-cream text-ink", className)}>
      {children}
    </div>
  );
}
