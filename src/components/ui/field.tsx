import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Field({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="field" className={cn("space-y-2", className)} {...props} />
  );
}

export function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-base leading-relaxed text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      role="alert"
      className={cn(
        "text-base font-medium leading-relaxed text-destructive",
        className,
      )}
      {...props}
    />
  );
}
