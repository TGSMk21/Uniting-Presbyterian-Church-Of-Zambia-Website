import { notFound } from "next/navigation";
import NavClient from "@/components/UniversalComponents/nav-client";
import FooterClient from "@/components/UniversalComponents/footer-client";
import { getBranch } from "@/Services/api";

export async function generateMetadata({ params }) {
  const { branch } = await params;
  const data = await getBranch(branch);
  if (!data) return { title: "Branch not found" };
  return {
    title: `${data.name} — Uniting Presbyterian Church In Zambia`,
    description: data.address
      ? `${data.name}, ${data.address}. A branch of the Uniting Presbyterian Church In Zambia.`
      : `${data.name} — a branch of the Uniting Presbyterian Church In Zambia.`,
  };
}

export default async function BranchLayout({ children, params }) {
  const { branch } = await params;
  const data = await getBranch(branch);
  if (!data) notFound();

  const base = `/${branch}`;
  const brand = {
    name: data.name,
    sub: "Church",
    href: base,
    description: "Walking in Faith, Living in Love. A community of believers rooted in the Gospel.",
  };
  const links = [
    { label: "Home", href: base },
    { label: "Sermons", href: `${base}/sermons` },
    { label: "Projects", href: `${base}/projects-and-activities` },
    { label: "About", href: `${base}/about` },
  ];
  const contact = { email: data.contact_email, phone: data.contact_phone };

  return (
    <>
      <NavClient brand={brand} links={links} />
      {children}
      <FooterClient brand={brand} links={links} contact={contact} />
    </>
  );
}
