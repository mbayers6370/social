import gregoire from "@/assets/demo/greg-gontier-gregoire.jpg";
import pinkMoon from "@/assets/demo/pink-moon.png";
import lovelyDay from "@/assets/demo/lovely-day.png";
import dreams from "@/assets/demo/dreams.png";
import type { ProfileTrack } from "@/features/profile/music-schema";
import { imageData } from "./feed";

/** Existing fictional profile defaults retain their original order. */
export const demoProfileTracks: ProfileTrack[] = [
  {
    id: "demo-pink-moon",
    title: "Pink Moon",
    artist: "Nick Drake",
    artwork: imageData(pinkMoon),
    spotifyUrl: "https://open.spotify.com/search/Nick%20Drake%20Pink%20Moon",
  },
  {
    id: "demo-lovely-day",
    title: "Lovely Day",
    artist: "Bill Withers",
    artwork: imageData(lovelyDay),
    spotifyUrl: "https://open.spotify.com/search/Bill%20Withers%20Lovely%20Day",
  },
  {
    id: "demo-dreams",
    title: "Dreams",
    artist: "Fleetwood Mac",
    artwork: imageData(dreams),
    spotifyUrl: "https://open.spotify.com/search/Fleetwood%20Mac%20Dreams",
  },
];

/** User-supplied cover and manually defined song information; no runtime catalogue calls. */
export const inesDemoTrack: ProfileTrack = {
  id: "demo-je-veux",
  title: "Je veux",
  artist: "Greg Gontier",
  artwork: imageData(gregoire),
  spotifyUrl: "https://open.spotify.com/track/5SKNuosJIUYtzmIj8nzQbu",
};
export const demoTracks: ProfileTrack[] = [...demoProfileTracks, inesDemoTrack];
