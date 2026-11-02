'use client';

import { useActionState } from "react";
import sendEmail from "@/components/HomeComponents/ContactComponets/send-email";

const FAILURE_MESSAGES = {
  invalid: "Please check your details and try again.",
  rate_limited: "Too many messages from your connection. Please try again in a few minutes.",
  unavailable: "Sorry, your message couldn't be sent right now. Please try again later.",
};

// `branch` is the branch slug; omit it on national pages to reach the national office.
export default function ContactForm({ branch = null }) {
  async function submitFormAction(previousState, formData) {
    try {
      const response = await sendEmail({
        branch,
        fullName: formData.get("fullName"),
        phoneNumber: formData.get("phoneNumber"),
        email: formData.get("email"),
        message: formData.get("message"),
        website: formData.get("website"),
      });
      if (response?.ok) return { err: false, message: "Message Sent Successfully! Thank You." };
      return { err: true, message: FAILURE_MESSAGES[response?.reason] || FAILURE_MESSAGES.unavailable };
    } catch (err) {
      console.error("Send Email Error", err);
      return { err: true, message: FAILURE_MESSAGES.unavailable };
    }
  }

  const [state, formAction, isPending] = useActionState(submitFormAction, {
    err: false,
    message: null,
  });

  return (
    <form action={formAction}>
      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="fullName">Full Name</label>
          <input className="form-input" id="fullName" name="fullName" type="text" required maxLength={100} placeholder="Jane Doe" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="phoneNumber">Phone Number</label>
          <input className="form-input" id="phoneNumber" name="phoneNumber" type="tel" required maxLength={30} placeholder="e.g. 0977677777" />
        </div>
        <div className="form-group full">
          <label className="form-label" htmlFor="email">Email Address</label>
          <input className="form-input" id="email" name="email" type="email" required maxLength={254} placeholder="example@example.com" />
        </div>
        <div className="form-group full">
          <label className="form-label" htmlFor="message">Message</label>
          <textarea className="form-textarea" id="message" name="message" rows={4} required maxLength={5000} placeholder="Say something..." />
        </div>
      </div>
      <button type="submit" disabled={isPending} className="form-submit">
        {isPending ? "Submitting..." : "Send Message"}
      </button>
      {state.message && (
        <div className={`form-status ${state.err ? "error" : "success"}`}>
          {state.message}
        </div>
      )}
    </form>
  );
}
