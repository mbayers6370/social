import { Fragment } from "react";
import Link from "next/link";
import { publicSiteDetails } from "./site-details";
export type PublicDocumentData = {
  category: "Explore" | "Support" | "Legal";
  title: string;
  intro: string;
  summary: string[];
  related?: { label: string; href: string }[];
  draft?: boolean;
  sections: {
    id: string;
    /** Optional heading that gathers neighbouring sections on long pages. */
    group?: string;
    title: string;
    paragraphs?: string[];
    points?: string[];
    links?: { label: string; href: string }[];
  }[];
};
function startsGroup(
  sections: PublicDocumentData["sections"],
  index: number,
): string | undefined {
  const group = sections[index].group;
  return group && group !== sections[index - 1]?.group ? group : undefined;
}
export function PublicDocument({ document }: { document: PublicDocumentData }) {
  return (
    <article
      className="margin-public-document"
      data-category={document.category}
    >
      <header className="margin-public-document-opening">
        <div>
          <p className="margin-public-kicker">{document.category}</p>
          <h1>{document.title}</h1>
          <p className="margin-public-intro">{document.intro}</p>
        </div>
        <div className="margin-public-document-summary">
          <p>At a glance</p>
          <ul>
            {document.summary.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </header>
      {document.draft && (
        <aside className="margin-public-draft" aria-label="Policy draft status">
          <strong>Draft · No effective date</strong>
          <p>
            You’re reading a policy draft, not an active agreement. We’ll
            publish an effective date after legal review. If you have a
            question, email{" "}
            <a href={`mailto:${publicSiteDetails.supportEmail}`}>
              {publicSiteDetails.supportEmail}
            </a>
            .
          </p>
        </aside>
      )}
      <div className="margin-public-document-body">
        <nav className="margin-public-contents" aria-label="On this page">
          <p>On this page</p>
          {document.sections.map((section, index) => {
            const group = startsGroup(document.sections, index);
            return (
              <Fragment key={section.id}>
                {group && (
                  <p className="margin-public-contents-group">{group}</p>
                )}
                <a href={`#${section.id}`}>{section.title}</a>
              </Fragment>
            );
          })}
        </nav>
        <div className="margin-public-sections">
          {document.sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              data-group-start={
                startsGroup(document.sections, index) ? "" : undefined
              }
            >
              {startsGroup(document.sections, index) && (
                <p className="margin-public-section-group">{section.group}</p>
              )}
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.points && (
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
              {section.links?.map((link) => (
                <Link
                  className="margin-public-inline-link"
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </Link>
              ))}
            </section>
          ))}
        </div>
      </div>
      {document.related && (
        <footer className="margin-public-document-related">
          <p>Keep reading</p>
          <nav aria-label="Related pages">
            {document.related.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </footer>
      )}
    </article>
  );
}
