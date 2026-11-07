import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
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
    title: string;
    paragraphs?: string[];
    points?: string[];
    links?: { label: string; href: string }[];
    portrait?: {
      image: StaticImageData;
      alt: string;
      caption: string;
    };
  }[];
};
function DocumentSectionContent({
  section,
}: {
  section: PublicDocumentData["sections"][number];
}) {
  const copy = (
    <>
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
      {section.portrait && (
        <p className="margin-public-portrait-caption">
          {section.portrait.caption}
        </p>
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
    </>
  );
  if (!section.portrait) return copy;
  return (
    <div className="margin-public-portrait-card">
      <div className="margin-public-portrait-copy">{copy}</div>
      <figure className="margin-public-portrait-photo">
        <Image
          src={section.portrait.image}
          alt={section.portrait.alt}
          sizes="(min-width: 640px) 208px, (max-width: 367px) calc(100vw - 48px), 280px"
        />
      </figure>
    </div>
  );
}
export function PublicDocument({ document }: { document: PublicDocumentData }) {
  return (
    <article
      className="margin-public-document"
      data-category={document.category}
    >
      <header className="margin-public-document-opening">
        <div>
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
            This is a policy draft, not an active agreement. Legal review and
            operator details remain outstanding. Email{" "}
            <a href={"mailto:" + publicSiteDetails.supportEmail}>
              {publicSiteDetails.supportEmail}
            </a>{" "}
            with questions.
          </p>
        </aside>
      )}
      <div className="margin-public-document-body">
        <nav className="margin-public-contents" aria-label="On this page">
          <p>On this page</p>
          {document.sections.map((section) => (
            <a key={section.id} href={"#" + section.id}>
              {section.title}
            </a>
          ))}
        </nav>
        <div className="margin-public-sections">
          {document.sections.map((section) => (
            <section key={section.id} id={section.id}>
              <DocumentSectionContent section={section} />
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
