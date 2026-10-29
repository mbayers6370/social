import Link from "next/link";
import { publicSiteDetails } from "./site-details";
export type PublicDocumentData = {
  title: string;
  intro: string;
  draft?: boolean;
  sections: {
    id: string;
    title: string;
    paragraphs?: string[];
    points?: string[];
    links?: { label: string; href: string }[];
  }[];
};
export function PublicDocument({ document }: { document: PublicDocumentData }) {
  return (
    <article className="margin-public-document">
      <header>
        <p className="margin-public-kicker">
          {document.draft
            ? publicSiteDetails.status
            : "A little more about margin"}
        </p>
        <h1>{document.title}</h1>
        <p className="margin-public-intro">{document.intro}</p>
      </header>
      {document.draft && (
        <aside className="margin-public-draft" aria-label="Policy draft status">
          <strong>Draft · No effective date</strong>
          <p>
            For review before launch. The legal operator has not been confirmed;
            margin is the platform name, not a statement of incorporation.{" "}
            {publicSiteDetails.supportEmail} is a temporary placeholder, not a
            monitored support inbox. Both must be replaced or confirmed before
            publication.
          </p>
        </aside>
      )}
      <nav className="margin-public-contents" aria-label="On this page">
        {document.sections.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.title}
          </a>
        ))}
      </nav>
      <div className="margin-public-sections">
        {document.sections.map((section) => (
          <section key={section.id} id={section.id}>
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
    </article>
  );
}
