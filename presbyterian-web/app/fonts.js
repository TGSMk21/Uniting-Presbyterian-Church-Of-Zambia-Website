import { Inter, Playfair_Display, Cormorant_Garamond } from "next/font/google";

export const inter = Inter({ subsets: ["latin"] });

export const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
});
