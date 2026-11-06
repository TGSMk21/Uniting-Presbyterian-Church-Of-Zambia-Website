// Fonts ship with the site (@fontsource packages) rather than next/font/google,
// whose build-time download made about 1 build in 6 fail at random.
import localFont from "next/font/local";

export const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
});

export const playfair = localFont({
  src: "../node_modules/@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2",
  weight: "400 900",
  display: "swap",
  variable: "--font-playfair",
});

export const cormorant = localFont({
  src: [
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2", weight: "500" },
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2", weight: "600" },
    { path: "../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2", weight: "700" },
  ],
  display: "swap",
  variable: "--font-cormorant",
});
