import NavClient from "@/components/UniversalComponents/nav-client";
import FooterClient from "@/components/UniversalComponents/footer-client";
import { getBranches, getPageContent } from "@/Services/api";
import { BranchPicker } from "@/components/UniversalComponents/my-branch";
import { pageFields } from "@/Utilities/pageContent.mjs";

export default async function NationalLayout({ children }) {
  const [content, branchData] = await Promise.all([getPageContent("national"), getBranches()]);
  const branches = (branchData?.results || []).map(({ slug, name }) => ({ slug, name }));
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
  const contact = { email: f.email };

  return (
    <>
      <NavClient brand={brand} links={links} />
      {children}
      <BranchPicker branches={branches} />
      <FooterClient brand={brand} links={links} contact={contact} />
    </>
  );
}
