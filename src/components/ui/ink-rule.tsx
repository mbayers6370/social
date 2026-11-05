import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type InkRuleProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  variant?: "dry" | "ribbon" | "smudge";
  width?: CSSProperties["width"];
  decorative?: boolean;
};

/** A fixed-grain ink divider. Width changes its length; color follows currentColor. */
export function InkRule({
  variant = "dry",
  width,
  decorative = false,
  className,
  style,
  ...props
}: InkRuleProps) {
  return (
    <div
      {...props}
      className={cn("margin-ink-rule", className)}
      data-variant={variant}
      role={decorative ? undefined : "separator"}
      aria-orientation={decorative ? undefined : "horizontal"}
      aria-hidden={decorative ? true : undefined}
      style={width === undefined ? style : { ...style, width }}
    >
      <span className="margin-ink-rule-core" aria-hidden="true" />
    </div>
  );
}
