/**
 * NBI Smart Attendance — Email Service
 *
 * Wraps Nodemailer. When SMTP credentials are not configured in .env
 * the service falls back to console-logging the email body so
 * development and testing work without an SMTP provider.
 *
 * To enable real email delivery, set these in backend/.env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your@email.com
 *   SMTP_PASS=yourapppassword
 *   SMTP_FROM=noreply@nbi-institute.edu.gh
 */

import nodemailer from "nodemailer";

function isSmtpConfigured(): boolean {
    return Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
    );
}

function createTransport() {
    if (!isSmtpConfigured()) return null;

    return nodemailer.createTransport({
        host:   process.env.SMTP_HOST,
        port:   Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

interface SendOptions {
    to:       string;
    subject:  string;
    html:     string;
    text:     string;
    replyTo?: string;  // optional Reply-To header
}

export async function sendEmail(opts: SendOptions): Promise<void> {
    const transport = createTransport();

    if (!transport) {
        console.log("\n────────────────────────────────────────────");
        console.log(`📧  EMAIL (console fallback — SMTP not configured)`);
        console.log(`To:      ${opts.to}`);
        if (opts.replyTo) console.log(`Reply-To: ${opts.replyTo}`);
        console.log(`Subject: ${opts.subject}`);
        console.log(`Body:\n${opts.text}`);
        console.log("────────────────────────────────────────────\n");
        return;
    }

    await transport.sendMail({
        from:    process.env.SMTP_FROM || `"NBI Institute" <${process.env.SMTP_USER}>`,
        to:      opts.to,
        subject: opts.subject,
        html:    opts.html,
        text:    opts.text,
        ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });
}

/* ------------------------------------------------------------------ */
/*  Composed email templates                                            */
/* ------------------------------------------------------------------ */

export async function sendVerificationEmail(
    to:   string,
    name: string,
    code: string
): Promise<void> {
    await sendEmail({
        to,
        subject: "Verify your NBI Institute account",
        text: [
            `Hello ${name},`,
            ``,
            `Your NBI Smart Attendance account has been created.`,
            ``,
            `Your verification code is:  ${code}`,
            ``,
            `Enter this code on the verification page to activate your account.`,
            `The code expires in 24 hours.`,
            ``,
            `If you did not expect this email, please contact the institute administrator.`,
            ``,
            `NBI Institute`,
        ].join("\n"),
        html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
  <div style="margin-bottom:24px">
    <div style="display:inline-block;background:#4f7fff;color:#fff;font-weight:800;
                font-size:12px;letter-spacing:.06em;padding:6px 12px;border-radius:8px">
      NBI
    </div>
  </div>
  <h1 style="font-size:22px;font-weight:700;color:#0f1117;margin:0 0 8px">
    Verify your account
  </h1>
  <p style="color:#445069;margin:0 0 24px">Hello ${name},</p>
  <p style="color:#445069;margin:0 0 24px">
    Your NBI Smart Attendance account has been created.
    Enter the code below on the verification page to activate it.
  </p>
  <div style="background:#f4f6fb;border:1px solid #e2e6f0;border-radius:12px;
              padding:24px;text-align:center;margin-bottom:24px">
    <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#0f1117">
      ${code}
    </div>
    <p style="color:#8892a4;font-size:13px;margin:12px 0 0">
      This code expires in 24 hours.
    </p>
  </div>
  <p style="color:#8892a4;font-size:13px">
    If you did not expect this email, please contact the institute administrator.
  </p>
  <hr style="border:none;border-top:1px solid #e2e6f0;margin:24px 0">
  <p style="color:#8892a4;font-size:12px;margin:0">NBI Institute · Smart Attendance System</p>
</div>`,
    });
}

export async function sendTempPasswordEmail(
    to:           string,
    name:         string,
    tempPassword: string
): Promise<void> {
    await sendEmail({
        to,
        subject: "Your NBI Institute account has been created",
        text: [
            `Hello ${name},`,
            ``,
            `Your NBI Smart Attendance account has been set up.`,
            ``,
            `Email:            ${to}`,
            `Temporary password: ${tempPassword}`,
            ``,
            `Use this temporary password to sign in for the first time.`,
            `You will be prompted to verify your email address after signing in.`,
            ``,
            `NBI Institute`,
        ].join("\n"),
        html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
  <div style="margin-bottom:24px">
    <div style="display:inline-block;background:#4f7fff;color:#fff;font-weight:800;
                font-size:12px;letter-spacing:.06em;padding:6px 12px;border-radius:8px">
      NBI
    </div>
  </div>
  <h1 style="font-size:22px;font-weight:700;color:#0f1117;margin:0 0 8px">
    Account created
  </h1>
  <p style="color:#445069;margin:0 0 24px">Hello ${name},</p>
  <p style="color:#445069;margin:0 0 24px">
    Your NBI Smart Attendance account has been set up by the administrator.
  </p>
  <div style="background:#f4f6fb;border:1px solid #e2e6f0;border-radius:12px;
              padding:20px 24px;margin-bottom:24px">
    <p style="margin:0 0 8px;color:#0f1117"><strong>Email:</strong> ${to}</p>
    <p style="margin:0;color:#0f1117">
      <strong>Temporary password:</strong>
      <span style="font-size:22px;font-weight:800;letter-spacing:4px;color:#4f7fff">
        ${tempPassword}
      </span>
    </p>
  </div>
  <p style="color:#445069">
    Use this temporary password to sign in. You will be asked to verify
    your email address after signing in.
  </p>
  <hr style="border:none;border-top:1px solid #e2e6f0;margin:24px 0">
  <p style="color:#8892a4;font-size:12px;margin:0">NBI Institute · Smart Attendance System</p>
</div>`,
    });
}

export async function sendPasswordResetEmail(
    to:   string,
    name: string,
    code: string
): Promise<void> {
    await sendEmail({
        to,
        subject: "NBI Institute — Password Reset Code",
        text: [
            `Hello ${name},`,
            ``,
            `A password reset was requested for your NBI Institute account.`,
            ``,
            `Your reset code is:  ${code}`,
            ``,
            `This code expires in 15 minutes. If you did not request a password reset,`,
            `please ignore this email and contact the institute administrator.`,
            ``,
            `NBI Institute`,
        ].join("\n"),
        html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
  <div style="margin-bottom:24px">
    <div style="display:inline-block;background:#4f7fff;color:#fff;font-weight:800;
                font-size:12px;letter-spacing:.06em;padding:6px 12px;border-radius:8px">
      NBI
    </div>
  </div>
  <h1 style="font-size:22px;font-weight:700;color:#0f1117;margin:0 0 8px">
    Password Reset
  </h1>
  <p style="color:#445069;margin:0 0 24px">Hello ${name},</p>
  <p style="color:#445069;margin:0 0 24px">
    A password reset was requested for your NBI Institute account.
    Enter the code below to reset your password.
  </p>
  <div style="background:#f4f6fb;border:1px solid #e2e6f0;border-radius:12px;
              padding:24px;text-align:center;margin-bottom:24px">
    <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#0f1117">
      ${code}
    </div>
    <p style="color:#8892a4;font-size:13px;margin:12px 0 0">
      This code expires in 15 minutes.
    </p>
  </div>
  <p style="color:#8892a4;font-size:13px">
    If you did not request a password reset, please ignore this email and
    contact the institute administrator immediately.
  </p>
  <hr style="border:none;border-top:1px solid #e2e6f0;margin:24px 0">
  <p style="color:#8892a4;font-size:12px;margin:0">NBI Institute · Smart Attendance System</p>
</div>`,
    });
}

export async function sendContactAdminEmail(opts: {
    senderName:    string;   // name the person entered (or "Anonymous")
    senderEmail:   string;   // email the person provided to receive a reply
    message:       string;   // the message body
}): Promise<void> {
    // The RECIPIENT is the configured SMTP_USER — the institute's own inbox.
    // The SENDER (From:) is also SMTP_USER / SMTP_FROM.
    // The REPLY-TO is set to senderEmail so the admin can reply directly.
    const adminInbox = process.env.SMTP_USER ?? "";

    if (!adminInbox) {
        console.warn("SMTP_USER is not set — contact-admin email has no destination.");
        throw new Error("Institute administrator email is not configured on this server.");
    }

    await sendEmail({
        to:      adminInbox,
        subject: `NBI Institute — Contact Request from ${opts.senderName}`,
        replyTo: opts.senderEmail,  // admin can click Reply → goes to requester
        text: [
            `You have received a contact request through the NBI Smart Attendance System.`,
            ``,
            `From:    ${opts.senderName}`,
            `Email:   ${opts.senderEmail}`,
            ``,
            `Message:`,
            opts.message,
            ``,
            `─────────────────────────────────────────────────`,
            `Reply to this email to respond directly to ${opts.senderEmail}.`,
            ``,
            `NBI Institute · Smart Attendance System`,
        ].join("\n"),
        html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="margin-bottom:24px">
    <div style="display:inline-block;background:#4f7fff;color:#fff;font-weight:800;
                font-size:12px;letter-spacing:.06em;padding:6px 12px;border-radius:8px">
      NBI
    </div>
  </div>
  <h1 style="font-size:20px;font-weight:700;color:#0f1117;margin:0 0 8px">
    Contact Request
  </h1>
  <p style="color:#445069;margin:0 0 20px">
    A contact request was submitted through the NBI Smart Attendance System.
  </p>
  <div style="background:#f4f6fb;border:1px solid #e2e6f0;border-radius:12px;
              padding:20px 24px;margin-bottom:24px">
    <p style="margin:0 0 8px;color:#0f1117"><strong>From:</strong> ${opts.senderName}</p>
    <p style="margin:0 0 16px;color:#0f1117"><strong>Email:</strong>
      <a href="mailto:${opts.senderEmail}" style="color:#4f7fff">${opts.senderEmail}</a>
    </p>
    <p style="margin:0 0 6px;color:#0f1117"><strong>Message:</strong></p>
    <p style="margin:0;color:#445069;white-space:pre-wrap">${opts.message.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>
  </div>
  <p style="color:#8892a4;font-size:13px">
    Reply to this email to respond directly to ${opts.senderEmail}.
  </p>
  <hr style="border:none;border-top:1px solid #e2e6f0;margin:24px 0">
  <p style="color:#8892a4;font-size:12px;margin:0">NBI Institute · Smart Attendance System</p>
</div>`,
    });
}

/* ------------------------------------------------------------------ */
/*  Account Activation — OTP email                                     */
/*  Sent when a pre-registered person requests to activate their       */
/*  account for the first time (NOT password reset).                  */
/* ------------------------------------------------------------------ */

export async function sendActivationOtpEmail(
    to:   string,
    name: string,
    role: string,
    code: string
): Promise<void> {
    const roleLabel =
        role === "student"  ? "Student"
        : role === "lecturer" ? "Lecturer"
        : "Administrator";

    await sendEmail({
        to,
        subject: "Activate your NBI Institute account",
        text: [
            `Hello ${name},`,
            ``,
            `Welcome to the NBI Institute Smart Attendance System!`,
            `Your ${roleLabel} account has been pre-registered by the institute administrator.`,
            ``,
            `To activate your account and create your password, enter the code below:`,
            ``,
            `Your activation code:  ${code}`,
            ``,
            `This code expires in 30 minutes.`,
            ``,
            `If you did not request account activation, please contact the institute administrator.`,
            ``,
            `NBI Institute`,
        ].join("\n"),
        html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
  <div style="margin-bottom:24px">
    <div style="display:inline-block;background:#4f7fff;color:#fff;font-weight:800;
                font-size:12px;letter-spacing:.06em;padding:6px 12px;border-radius:8px">
      NBI
    </div>
  </div>
  <h1 style="font-size:22px;font-weight:700;color:#0f1117;margin:0 0 8px">
    Activate your account
  </h1>
  <p style="color:#445069;margin:0 0 16px">Hello ${name},</p>
  <p style="color:#445069;margin:0 0 16px">
    Welcome to the NBI Institute Smart Attendance System! Your <strong>${roleLabel}</strong>
    account has been pre-registered. Enter the code below to activate your account
    and create your own password.
  </p>
  <div style="background:#f4f6fb;border:1px solid #e2e6f0;border-radius:12px;
              padding:24px;text-align:center;margin-bottom:24px">
    <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#0f1117">
      ${code}
    </div>
    <p style="color:#8892a4;font-size:13px;margin:12px 0 0">
      This code expires in 30 minutes.
    </p>
  </div>
  <p style="color:#8892a4;font-size:13px">
    If you did not expect this email, please contact the institute administrator.
  </p>
  <hr style="border:none;border-top:1px solid #e2e6f0;margin:24px 0">
  <p style="color:#8892a4;font-size:12px;margin:0">NBI Institute · Smart Attendance System</p>
</div>`,
    });
}

/* ------------------------------------------------------------------ */
/*  Welcome email — sent after successful account activation          */
/*  Role-specific messaging.                                           */
/* ------------------------------------------------------------------ */

export async function sendWelcomeEmail(
    to:   string,
    name: string,
    role: string
): Promise<void> {
    const roleLabel =
        role === "student"  ? "Student"
        : role === "lecturer" ? "Lecturer"
        : "Administrator";

    const roleMessage =
        role === "student"
            ? "You can now log in to view your attendance records, enrolled courses, and academic progress."
            : role === "lecturer"
            ? "You can now log in to manage attendance sessions, generate QR codes, and view your course attendance reports."
            : "You now have full access to the NBI Smart Attendance administration panel.";

    await sendEmail({
        to,
        subject: `Welcome to NBI Institute — Account Activated`,
        text: [
            `Hello ${name},`,
            ``,
            `Your NBI Institute ${roleLabel} account is now active.`,
            ``,
            roleMessage,
            ``,
            `Sign in at your institute portal using your registered email address.`,
            ``,
            `NBI Institute`,
        ].join("\n"),
        html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
  <div style="margin-bottom:24px">
    <div style="display:inline-block;background:#4f7fff;color:#fff;font-weight:800;
                font-size:12px;letter-spacing:.06em;padding:6px 12px;border-radius:8px">
      NBI
    </div>
  </div>
  <h1 style="font-size:22px;font-weight:700;color:#0f1117;margin:0 0 8px">
    Welcome, ${name}!
  </h1>
  <p style="color:#445069;margin:0 0 16px">
    Your NBI Institute <strong>${roleLabel}</strong> account is now active.
  </p>
  <p style="color:#445069;margin:0 0 24px">${roleMessage}</p>
  <div style="background:#f4f6fb;border:1px solid #e2e6f0;border-radius:12px;padding:16px 20px;margin-bottom:24px">
    <p style="margin:0;color:#0f1117"><strong>Email:</strong> ${to}</p>
    <p style="margin:8px 0 0;color:#445069;font-size:14px">Use this email address to sign in.</p>
  </div>
  <hr style="border:none;border-top:1px solid #e2e6f0;margin:24px 0">
  <p style="color:#8892a4;font-size:12px;margin:0">NBI Institute · Smart Attendance System</p>
</div>`,
    });
}
