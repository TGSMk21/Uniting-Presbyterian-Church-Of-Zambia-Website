'use server';

import { Resend } from "resend";
import EmailTemplate from "../../../react-email-starter/emails/email-template";
import { headers } from "next/headers";
import { limiter } from "@/Utilities/ratelimit";
import { getBranch } from "@/Services/api";
import { clientIp, resolveRecipient, validateContact } from "@/Utilities/contactMessage";

// Resend's sandbox sender only delivers to the Resend account owner; set
// RESEND_FROM_EMAIL to an address on a verified domain before going live.
const SANDBOX_FROM = "Church Website <onboarding@resend.dev>";

// Returns { ok: true } or { ok: false, reason: "invalid" | "rate_limited" | "unavailable" }.
export default async function sendEmail({ branch, website, ...input }) {
  // Honeypot: people never fill the hidden field; bots do. Pretend it worked.
  if (website) return { ok: true };

  const checked = validateContact(input);
  if (!checked.ok) return { ok: false, reason: "invalid" };
  const { fullName, phoneNumber, email, message } = checked.fields;

  const ip = clientIp((await headers()).get("x-forwarded-for"));
  try {
    const { success } = await limiter.limit(ip);
    if (!success) return { ok: false, reason: "rate_limited" };
  } catch (err) {
    // Don't lose messages when Upstash is down; the honeypot still applies.
    console.error("Rate limiter unavailable", err);
  }

  const to = await resolveRecipient(branch, {
    getBranch,
    nationalEmail: process.env.NATIONAL_CONTACT_EMAIL,
  });
  if (!to) {
    console.error(`No contact address for ${branch ? `branch "${branch}"` : "the national office"}`);
    return { ok: false, reason: "unavailable" };
  }

  const now = new Date();
  const currentDate = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "2-digit" }).format(now);
  const currentTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }).format(now);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || SANDBOX_FROM,
      to,
      replyTo: email,
      subject: `New website message from ${fullName}`,
      react: EmailTemplate({ fullName, phoneNumber, email, message, currentTime, currentDate }),
    });
    if (error) {
      console.error("Resend rejected the message", error);
      return { ok: false, reason: "unavailable" };
    }
    return { ok: true };
  } catch (err) {
    console.error("Email send error", err);
    return { ok: false, reason: "unavailable" };
  }
}
