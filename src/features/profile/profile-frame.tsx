import type { ReactNode } from "react";

/** One profile rail keeps identity and details together without nested scrolling. */
export function ProfileFrame({
  identity,
  details,
  children,
}: {
  identity: ReactNode;
  details: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="margin-profile">
      <div className="margin-profile-rail">
        {identity}
        {details}
      </div>
      {children}
    </div>
  );
}
