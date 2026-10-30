import Image from "next/image";
import tea from "@/assets/fixtures/tea.jpg";
import river from "@/assets/fixtures/mara-photography.jpg";
import usualCompany from "@/assets/fixtures/usual-company.jpg";

const photographs = [
  {
    image: tea,
    caption: "The slow mornings.",
    alt: "A cup of tea, an open book and a small radio in the morning light.",
  },
  {
    image: river,
    caption: "The long way home.",
    alt: "City lights reflected in the river beneath a bridge at dusk.",
  },
  {
    image: usualCompany,
    caption: "The usual company.",
    alt: "A small dog wearing round sunglasses and a sun hat, held in someone’s arms.",
  },
];

/** Static public sample photographs, never private gallery data. */
export function WelcomeGallery() {
  return (
    <div className="margin-welcome-gallery">
      {photographs.map(({ image, caption, alt }) => (
        <figure key={caption}>
          <div className="margin-welcome-gallery-photo">
            <Image
              src={image}
              alt={alt}
              sizes="(max-width: 767px) 30vw, (max-width: 1023px) 40vw, 30vw"
            />
          </div>
          <figcaption>{caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}
