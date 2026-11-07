"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmTwoFactor } from "@/app/dashboard/actions";

export default function TwoFactorSetupForm({ qrCode, secretKey }) {
  const [state, action, pending] = useActionState(confirmTwoFactor, { error: null, recoveryCodes: null });

  if (state.recoveryCodes) {
    return (
      <>
        <h1 className="dash-title">Save your recovery codes</h1>
        <p className="dash-text">
          Two-step login is on. If you lose your phone, each of these codes lets you sign in once.
          Write them down or print them and keep them somewhere safe. They won&apos;t be shown again.
        </p>
        <ul className="dash-codes">
          {state.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Link href="/dashboard" className="btn-primary dash-submit">
          I&apos;ve saved them
        </Link>
      </>
    );
  }

  if (!qrCode) {
    return (
      <>
        <h1 className="dash-title">Two-step login is on</h1>
        <p className="dash-text">Your account already uses two-step login.</p>
        <Link href="/dashboard" className="dash-back">
          Back to the dashboard
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="dash-title">Set up two-step login</h1>
      <ol className="dash-steps">
        <li>Install an authenticator app on your phone, such as Google Authenticator or Microsoft Authenticator.</li>
        <li>In the app, add an account and scan this code.</li>
      </ol>
      <img src={qrCode} alt="QR code to scan with your authenticator app" width="200" height="200" className="dash-qr" />
      <details className="dash-key">
        <summary>Can&apos;t scan it? Type this key instead</summary>
        <code>{secretKey}</code>
      </details>
      <ol className="dash-steps" start={3}>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <form action={action} className="dash-form">
        <label className="dash-field">
          <span>6-digit code</span>
          <input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required />
        </label>
        <p className="dash-error" role="alert">{state.error}</p>
        <button type="submit" className="btn-primary dash-submit" disabled={pending}>
          {pending ? "Checking…" : "Turn on two-step login"}
        </button>
      </form>
    </>
  );
}
