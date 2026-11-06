import NavClient from "@/components/UniversalComponents/nav-client";
import FooterClient from "@/components/UniversalComponents/footer-client";

export default function NationalLayout({ children }) {
  const brand = {
    name: "Uniting Presbyterian Church In Zambia",
    href: "/",
    description:
      "A family of branches across Zambia, rooted in the Gospel. Wherever you are, there is a place for you here.",
  };
  const links = [
    { label: "Home", href: "/" },
    { label: "Fellowships", href: "/#fellowships" },
    { label: "Events", href: "/#events" },
    { label: "Find a Branch", href: "/find-a-branch" },
    { label: "Contact", href: "/contact" },
  ];
  const contact = { email: "hello@upcz.org", phone: "+260 977 681 606" };

  return (
    <>
      <NavClient brand={brand} links={links} />
      {children}
      <FooterClient brand={brand} links={links} contact={contact} />
    </>
  );
}
