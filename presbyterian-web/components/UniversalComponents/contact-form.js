'use client';

import { useActionState } from "react";
import sendEmail from "@/components/HomeComponents/ContactComponets/send-email";

async function submitFormAction(previousState, formData) {
  try {
    const fullName = formData.get("fullName");
    const phoneNumber = formData.get("phoneNumber");
    const message = formData.get("message");
    const email = formData.get("email");
    const response = await sendEmail(fullName, phoneNumber, email, message);
    if (response.success) {
      return { err: true, message: "Error: Submission limit reached, Try again in an hour" };
    }
    if (response.messageSent)
      return { err: false, message: "Message Sent Successfully! Thank You." };
    else
      return { err: true, message: "Error: Message Not Sent" };
  } catch (err) {
    console.log("Send Email Error", err);
    return { err: true, message: "Error: Message Not Sent" };
  }
}

export default function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitFormAction, {
    err: false,
    message: null,
  });

  return (
    <form action={formAction}>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="fullName">Full Name</label>
          <input className="form-input" id="fullName" name="fullName" type="text" required placeholder="Jane Doe" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="phoneNumber">Phone Number</label>
          <input className="form-input" id="phoneNumber" name="phoneNumber" type="tel" required placeholder="e.g. 0977677777" />
        </div>
        <div className="form-group full">
          <label className="form-label" htmlFor="email">Email Address</label>
          <input className="form-input" id="email" name="email" type="email" required placeholder="example@example.com" />
        </div>
        <div className="form-group full">
          <label className="form-label" htmlFor="message">Message</label>
          <textarea className="form-textarea" id="message" name="message" rows={4} required placeholder="Say something..." />
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
