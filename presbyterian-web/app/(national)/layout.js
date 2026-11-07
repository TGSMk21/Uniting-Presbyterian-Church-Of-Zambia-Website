import NavClient from "@/components/UniversalComponents/nav-client";
import FooterClient from "@/components/UniversalComponents/footer-client";
import { getPageContent } from "@/Services/api";
import { pageFields } from "@/Utilities/pageContent.mjs";

export default async function NationalLayout({ children }) {
  const content = await getPageContent("national");
  const f = pageFields("national", "contact", content?.pages?.contact);
  const brand = {
    name: "Uniting Presbyterian Church In Zambia",
    href: "/",
    description: f.footer_text,
  };
  const links = [
    { label: "Home", href: "/" },
    { label: "Fellowships", href: "/#fellowships" },
    { label: "Events", href: "/#events" },
    { label: "Find a Branch", href: "/find-a-branch" },
    { label: "Contact", href: "/contact" },
  ];
  const contact = { email: f.email, phone: f.phone };

  return (
    <>
      <NavClient brand={brand} links={links} />
      {children}
      <FooterClient brand={brand} links={links} contact={contact} />
    </>
  );
}
