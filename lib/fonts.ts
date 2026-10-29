import { Caveat, Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";

// The one place to swap faces. Each exposes a CSS variable that globals.css
// maps onto Tailwind's font-serif / font-mono / font-hand / font-sans.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });

// TODO: replace Inter with a more distinctive UI face once the owner picks one.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const fontVariables = [fraunces, plexMono, caveat, inter]
  .map((f) => f.variable)
  .join(" ");
