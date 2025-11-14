import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button-1";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

const alertVariants = cva("flex items-stretch w-full gap-2", {
  variants: {
    variant: {
      secondary: "",
      primary: "",
      destructive: "",
      success: "",
      info: "",
      mono: "",
      warning: "",
    },
    icon: {
      primary: "",
      destructive: "",
      success: "",
      info: "",
      warning: "",
    },
    appearance: {
      solid: "",
      outline: "",
      light: "",
      stroke: "text-foreground",
    },
    size: {
      lg: "rounded-lg p-4 gap-3 text-base [&>[data-slot=alert-icon]>svg]:size-6 [&_[data-slot=alert-close]]:mt-1",
      md: "rounded-lg p-3.5 gap-2.5 text-sm [&>[data-slot=alert-icon]>svg]:size-5 [&_[data-slot=alert-close]]:mt-0.5",
      sm: "rounded-md px-3 py-2.5 gap-2 text-xs [&>[data-slot=alert-icon]>svg]:size-4 [&_[data-slot=alert-close]_svg]:size-3.5",
    },
  },
  compoundVariants: [
    { variant: "secondary", appearance: "solid", className: "bg-muted text-foreground" },
    { variant: "primary", appearance: "solid", className: "bg-primary text-primary-foreground" },
    { variant: "destructive", appearance: "solid", className: "bg-destructive text-destructive-foreground" },
    {
      variant: "success",
      appearance: "solid",
      className:
        "bg-[var(--color-success,hsl(142_55%_36%))] text-[var(--color-success-foreground,var(--color-white))]",
    },
    {
      variant: "info",
      appearance: "solid",
      className:
        "bg-[var(--color-info,hsl(205_90%_52%))] text-[var(--color-info-foreground,var(--color-white))]",
    },
    {
      variant: "warning",
      appearance: "solid",
      className:
        "bg-[var(--color-warning,hsl(38_92%_50%))] text-[var(--color-warning-foreground,var(--color-white))]",
    },
    { variant: "mono", appearance: "solid", className: "bg-zinc-950 text-white dark:bg-zinc-300 dark:text-black" },

    { variant: "secondary", appearance: "outline", className: "border border-border bg-background text-foreground" },
    { variant: "primary", appearance: "outline", className: "border border-border bg-background text-primary" },
    { variant: "destructive", appearance: "outline", className: "border border-border bg-background text-destructive" },
    {
      variant: "success",
      appearance: "outline",
      className: "border border-border bg-background text-[var(--color-success,hsl(142_55%_36%))]",
    },
    {
      variant: "info",
      appearance: "outline",
      className: "border border-border bg-background text-[var(--color-info,hsl(205_90%_52%))]",
    },
    {
      variant: "warning",
      appearance: "outline",
      className: "border border-border bg-background text-[var(--color-warning,hsl(38_92%_50%))]",
    },

    { variant: "secondary", appearance: "light", className: "bg-muted border border-border text-foreground" },
    {
      variant: "primary",
      appearance: "light",
      className: "text-foreground bg-primary/10 border border-primary/20 [&_[data-slot=alert-icon]]:text-primary",
    },
    {
      variant: "destructive",
      appearance: "light",
      className: "bg-destructive/10 border border-destructive/20 text-foreground [&_[data-slot=alert-icon]]:text-destructive",
    },
    {
      variant: "success",
      appearance: "light",
      className: "bg-[hsl(142_55%_36%)/.1] border border-[hsl(142_55%_36%)/.2] text-foreground [&_[data-slot=alert-icon]]:text-[hsl(142_55%_36%)]",
    },
    {
      variant: "info",
      appearance: "light",
      className: "bg-[hsl(205_90%_52%)/.1] border border-[hsl(205_90%_52%)/.2] text-foreground [&_[data-slot=alert-icon]]:text-[hsl(205_90%_52%)]",
    },
    {
      variant: "warning",
      appearance: "light",
      className: "bg-[hsl(38_92%_50%)/.1] border border-[hsl(38_92%_50%)/.2] text-foreground [&_[data-slot=alert-icon]]:text-[hsl(38_92%_50%)]",
    },
  ],
  defaultVariants: {
    variant: "secondary",
    appearance: "solid",
    size: "md",
  },
});

interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  close?: boolean;
  onClose?: () => void;
}

interface AlertIconProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

function Alert({ className, variant, size, icon, appearance, close = false, onClose, children, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant, size, icon, appearance }), className)}
      {...props}
    >
      {children}
      {close && (
        <Button
          size="sm"
          variant="inverse"
          mode="icon"
          onClick={onClose}
          aria-label="Dismiss"
          data-slot="alert-close"
          className={cn("group shrink-0 size-4")}
        >
          <X className="opacity-60 group-hover:opacity-100 size-4" />
        </Button>
      )}
    </div>
  );
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="alert-title" className={cn("grow tracking-tight", className)} {...props} />;
}

function AlertIcon({ children, className, ...props }: AlertIconProps) {
  return (
    <div data-slot="alert-icon" className={cn("shrink-0", className)} {...props}>
      {children}
    </div>
  );
}

function AlertToolbar({ children, className, ...props }: AlertIconProps) {
  return (
    <div data-slot="alert-toolbar" className={cn(className)} {...props}>
      {children}
    </div>
  );
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="alert-description" className={cn("text-sm [&_p]:leading-relaxed [&_p]:mb-2", className)} {...props} />
  );
}

function AlertContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="alert-content" className={cn("space-y-2 [&_[data-slot=alert-title]]:font-semibold", className)} {...props} />
  );
}

export { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle, AlertToolbar };


