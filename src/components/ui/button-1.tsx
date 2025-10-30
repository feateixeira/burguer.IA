import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Slot as SlotPrimitive } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "cursor-pointer group whitespace-nowrap focus-visible:outline-hidden inline-flex items-center justify-center text-sm font-medium ring-offset-background transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        outline: "bg-background text-accent-foreground border border-input hover:bg-accent",
        ghost: "text-accent-foreground hover:bg-accent hover:text-accent-foreground",
        inverse: "bg-foreground text-background hover:bg-foreground/90",
      },
      size: {
        lg: "h-10 rounded-md px-4",
        md: "h-9 rounded-md px-3",
        sm: "h-7 rounded-md px-2.5 text-xs",
        icon: "size-9 rounded-md",
      },
      mode: {
        default: "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        icon: "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        link: "text-primary h-auto p-0 bg-transparent rounded-none hover:bg-transparent",
        input: "justify-start font-normal",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      mode: "default",
    },
  }
);

function Button({ className, variant, mode, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? (SlotPrimitive as any) : "button";
  return (
    <Comp data-slot="button" className={cn(buttonVariants({ variant, size, mode, className }))} {...props} />
  );
}

interface ButtonArrowProps extends React.SVGProps<SVGSVGElement> {
  icon?: LucideIcon;
}

function ButtonArrow({ icon: Icon = ChevronDown, className, ...props }: ButtonArrowProps) {
  return <Icon data-slot="button-arrow" className={cn("ms-auto -me-1", className)} {...props} />;
}

export { Button, ButtonArrow, buttonVariants };


