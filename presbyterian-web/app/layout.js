import "./globals.css";
import { inter, playfair, cormorant } from "./fonts";

export const metadata = {
  title: "Uniting Presbyterian Church In Zambia",
  description: "One church, many homes — a family of branches across Zambia, rooted in the Gospel.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${cormorant.variable}`}>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
