/**
 * SMTP delivery of the participant's report using Nodemailer.
 *
 * Credentials come exclusively from the server-side env file:
 *   SMTP_HOST=smtp.titan.email
 *   SMTP_PORT=587
 *   SMTP_USER=heal@drvrushali.com
 *   SMTP_PASS=...
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let cached: Transporter | null = null;

export function mailerConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function getTransporter(): Transporter {
  if (cached) return cached;

  const port = Number(process.env.SMTP_PORT || 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER as string,
      pass: process.env.SMTP_PASS as string,
    },
    tls: { minVersion: "TLSv1.2" },
  });
  return cached;
}

export type ReportMail = {
  to: string;
  name: string;
  wcpsDisplay: string;
  label: string;
  interpretation: string;
  innerProfile: string;
  dimensions: { label: string; score: number; level: string }[];
  attachment: { filename: string; content: Buffer };
  attachmentIsPdf: boolean;
  volunteer?: string;
};

function buildHtml(mail: ReportMail): string {
  const rows = mail.dimensions
    .map(
      (d) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eef1f4;font-weight:600;color:#1f3b57;">${d.label}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eef1f4;text-align:right;color:#3d566e;">${d.score}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eef1f4;text-align:right;font-weight:600;color:#0f7b6c;">${d.level}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;color:#22303c;">
    <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
      <div style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e3eaf1;">
        <div style="background:#1f4e79;padding:26px 28px;">
          <p style="margin:0;letter-spacing:3px;font-size:11px;color:#cfe3f5;font-weight:700;">WEALTH CREATION POTENTIAL SCORE</p>
          <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;">Hello ${mail.name}, your report is ready</h1>
        </div>
        <div style="padding:26px 28px;">
          <div style="background:#eef7f4;border:1px solid #cfe8e1;border-radius:14px;padding:18px;text-align:center;">
            <p style="margin:0;font-size:12px;letter-spacing:2px;color:#0f7b6c;font-weight:700;">YOUR WCPS</p>
            <p style="margin:6px 0 0;font-size:26px;font-weight:800;color:#0f5f53;">${mail.wcpsDisplay}</p>
            <p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#3d566e;">${mail.interpretation}</p>
          </div>

          <p style="margin:22px 0 10px;font-size:13px;font-weight:700;color:#1f3b57;">Your inner profile</p>
          <p style="margin:0 0 18px;font-size:14px;color:#3d566e;">${mail.innerProfile}</p>

          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f7fafc;">
                <th style="text-align:left;padding:10px 14px;color:#5a7288;font-size:12px;">Dimension</th>
                <th style="text-align:right;padding:10px 14px;color:#5a7288;font-size:12px;">Score</th>
                <th style="text-align:right;padding:10px 14px;color:#5a7288;font-size:12px;">Level</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#3d566e;">
            Your full personalised report is attached as a
            <strong>${mail.attachmentIsPdf ? "PDF" : "Word document"}</strong>.
            This score describes factors that may influence long-term wealth creation. It is not a prediction or guarantee.
          </p>
          ${mail.volunteer ? `<p style="margin:14px 0 0;font-size:12px;color:#7a8ea1;">Referral: ${mail.volunteer}</p>` : ""}
        </div>
        <div style="padding:16px 28px;background:#f7fafc;border-top:1px solid #eef1f4;">
          <p style="margin:0;font-size:12px;color:#7a8ea1;">Happiness Holistic Clinic &nbsp;|&nbsp; heal@drvrushali.com &nbsp;|&nbsp; +91 77383 75783</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export async function sendReportEmail(mail: ReportMail): Promise<void> {
  const transporter = getTransporter();
  const fromName = process.env.MAIL_FROM_NAME || "Happiness Holistic Clinic";
  const from = `${fromName} <${process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from,
    to: mail.to,
    replyTo: process.env.MAIL_REPLY_TO || process.env.SMTP_USER,
    subject: `Your Wealth Creation Potential Score report — ${mail.wcpsDisplay}`,
    html: buildHtml(mail),
    text:
      `Hello ${mail.name},\n\n` +
      `Your Wealth Creation Potential Score is ${mail.wcpsDisplay}.\n` +
      `Inner profile: ${mail.innerProfile}\n\n` +
      `${mail.interpretation}\n\n` +
      `Your full report is attached.\n\nHappiness Holistic Clinic | heal@drvrushali.com | +91 77383 75783`,
    attachments: [
      {
        filename: mail.attachment.filename,
        content: mail.attachment.content,
        contentType: mail.attachmentIsPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ],
  });
}
