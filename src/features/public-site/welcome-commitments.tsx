const commitments = [
  "No like counts in the feed",
  "No ads",
  "No algorithm",
  "Posts disappear after 30 days",
  "Up to three posts a day",
];

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
          <ul
            className="margin-welcome-differences"
            aria-label="What’s different"
          >
            {commitments.map((commitment) => (
              <li key={commitment}>{commitment}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
