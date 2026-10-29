import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Shared quiet surface for the profile's music and gallery sections. */
export function ProfileSection({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn("margin-profile-section-card", className)}
      {...props}
    />
  );
}
