import type { IconProps } from "@/components/margin-icons";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One leading artwork slot and one text slot at every viewport width. */
export function SectionTitle({
  as: Heading = "h2",
  motif,
  children,
  className,
  ...props
}: ComponentProps<"h2"> & {
  as?: "h1" | "h2";
  motif: ReactNode;
}) {
  return (
    <Heading className={cn("margin-section-title", className)} {...props}>
      <span className="margin-section-title-motif" aria-hidden="true">
        {motif}
      </span>
      <span className="margin-section-title-text">{children}</span>
    </Heading>
  );
}

/** Decorative heading artwork; the adjacent text supplies the accessible name. */
export function SectionMotif({
  icon: Icon,
}: {
  icon: ComponentType<IconProps>;
}) {
  return (
    <Icon
      className="margin-section-motif"
      size={20}
      aria-hidden="true"
      focusable="false"
    />
  );
}
