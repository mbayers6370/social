import { cn } from "@/lib/utils";

const commitments = [
  "No like counts in the feed",
  "No ads",
  "No algorithm",
  "Posts disappear after 30 days",
  "Up to three posts a day",
];

function CommitmentList({ repeated = false }: { repeated?: boolean }) {
  return (
    <ul
      className={cn(
        "margin-welcome-differences",
        repeated && "margin-welcome-differences-copy",
      )}
      aria-label={repeated ? undefined : "What’s different"}
      aria-hidden={repeated || undefined}
    >
      {commitments.map((commitment) => (
        <li key={commitment}>{commitment}</li>
      ))}
    </ul>
  );
}

export function WelcomeCommitments() {
  return (
    <div className="margin-welcome-commitments">
      <div
        className="margin-welcome-commitments-viewport"
        tabIndex={0}
        role="region"
        aria-label="Margin commitments"
      >
        <div className="margin-welcome-commitments-track">
          <CommitmentList />
          <CommitmentList repeated />
        </div>
      </div>
    </div>
  );
}
