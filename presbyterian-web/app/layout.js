import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { inter, playfair, cormorant } from "./fonts";
import { themeScript } from "@/Utilities/theme.mjs";

export const metadata = {
  title: "Uniting Presbyterian Church In Zambia",
  description: "One church, many homes. A family of branches across Zambia, rooted in the Gospel.",
};

export default function RootLayout({ children }) {
  return (
    // The theme script sets data-theme on <html> before React loads, hence suppressHydrationWarning.
    <html lang="en" className={`${playfair.variable} ${cormorant.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
