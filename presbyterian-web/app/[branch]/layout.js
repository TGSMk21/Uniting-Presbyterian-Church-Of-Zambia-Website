import { notFound } from "next/navigation";
import NavClient from "@/components/UniversalComponents/nav-client";
import FooterClient from "@/components/UniversalComponents/footer-client";
import { MyBranchBar, MyBranchPrompt } from "@/components/UniversalComponents/my-branch";
import { getBranch, getPageContent } from "@/Services/api";
import { pageFields } from "@/Utilities/pageContent.mjs";

export async function generateMetadata({ params }) {
  const { branch } = await params;
  const data = await getBranch(branch);
  if (!data) return { title: "Branch not found" };
  return {
    title: `${data.name} — Uniting Presbyterian Church In Zambia`,
    description: data.address
      ? `${data.name}, ${data.address}. A branch of the Uniting Presbyterian Church In Zambia.`
      : `${data.name}, a branch of the Uniting Presbyterian Church In Zambia.`,
  };
}

export default async function BranchLayout({ children, params }) {
  const { branch } = await params;
  const [data, content] = await Promise.all([getBranch(branch), getPageContent(branch)]);
  if (!data) notFound();
  const { footer_text, logo } = pageFields(
    "branch",
    "home",
    { ...content?.pages?.home, logo: data.logo },
    { branchName: data.name },
  );

  const base = `/${branch}`;
  const brand = {
    name: data.name,
    sub: "Church",
    href: base,
    description: footer_text,
    logo,
  };
  const links = [
    { label: "Home", href: base },
    { label: "Sermons", href: `${base}/sermons` },
    { label: "Projects & Events", href: `${base}/projects-and-events` },
    { label: "About", href: `${base}/about` },
  ];
  const contact = { email: data.contact_email };

  return (
    <>
      <NavClient brand={brand} links={links} />
      {children}
      <MyBranchBar slug={branch} name={data.name} />
      <MyBranchPrompt slug={branch} name={data.name} />
      <FooterClient brand={brand} links={links} contact={contact} />
    </>
  );
}
