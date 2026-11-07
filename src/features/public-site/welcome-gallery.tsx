import Image from "next/image";
import tea from "@/assets/fixtures/tea.jpg";
import river from "@/assets/fixtures/mara-photography.jpg";
import usualCompany from "@/assets/fixtures/usual-company.jpg";

const photographs = [
  {
    image: tea,
    alt: "A cup of tea, an open book and a small radio in the morning light.",
  },
  {
    image: river,
    alt: "City lights reflected in the river beneath a bridge at dusk.",
  },
  {
    image: usualCompany,
    crop: "face",
    alt: "A small dog wearing round sunglasses and a sun hat, held in someone’s arms.",
  },
];

/** Static public sample photographs, never private gallery data. */
export function WelcomeGallery() {
  return (
    <div className="margin-welcome-gallery">
      {photographs.map(({ image, alt, crop }) => (
        <figure key={image.src}>
          <div className="margin-welcome-gallery-photo" data-crop={crop}>
            <Image
              src={image}
              alt={alt}
              sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1439px) 30vw, 411px"
            />
          </div>
        </figure>
      ))}
    </div>
  );
}
