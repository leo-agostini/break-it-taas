import type { ComponentPropsWithoutRef, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

function FieldGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-4", className)} {...props} />;
}

function Field({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-2", className)} {...props} />;
}

function FieldLabel({ className, ...props }: ComponentPropsWithoutRef<"label">) {
  return (
    <label
      className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

function FieldSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative text-center text-sm", className)} {...props}>
      <span className="relative z-10 bg-background px-2 text-muted-foreground">{props.children}</span>
      <span className="absolute inset-x-0 top-1/2 -z-0 border-t" />
    </div>
  );
}

export { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator };
