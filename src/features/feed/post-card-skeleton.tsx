/** A real loading fallback or an explicit workbench preview, never a timed delay. */
export function PostCardSkeleton({ media = false }: { media?: boolean }) {
  return (
    <div className="margin-post-card margin-post-skeleton" role="status">
      <span className="sr-only">Loading post…</span>
      <div className="margin-post-skeleton-content" aria-hidden="true">
        <div className="margin-post-skeleton-author">
          <span className="margin-post-skeleton-avatar" />
          <div className="margin-post-skeleton-identity">
            <span className="margin-post-skeleton-name" />
            <span className="margin-post-skeleton-time" />
          </div>
        </div>
        {media && <div className="margin-post-skeleton-media" />}
        <div className="margin-post-skeleton-prose">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
