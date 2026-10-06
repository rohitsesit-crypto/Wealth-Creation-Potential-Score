/**
 * SMTP delivery of the participant's report using Nodemailer.
 *
 * Credentials come exclusively from the server-side env file:
 *   SMTP_HOST=smtp.titan.email
 *   SMTP_PORT=587
 *   SMTP_USER=heal@drvrushali.com
 *   SMTP_PASS=...
 *
 * Mail providers expose the same mailboxes through several hostnames and each
 * hostname resolves to several IP addresses. Old addresses get decommissioned
 * and front hosts (e.g. GoDaddy's email.secureserver.net) can stop answering,
 * which makes the send hang until the OS gives up (ETIMEDOUT / ESOCKET).
 *
 * To keep delivery reliable we resolve the configured host plus its known
 * sibling hosts, probe every address on both 465 and 587 in parallel, and
 * connect to the first one that answers — retrying once on a dropped link.
 */

import dns from "node:dns/promises";
import net from "node:net";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

const CONNECT_TIMEOUT_MS = 8_000;

type Endpoint = { host: string; port: number; hostname: string };

let cached: { transporter: Transporter; endpoint: Endpoint } | null = null;

/** Read an env var as a trimmed string (guards against stray spaces/newlines). */
const env = (key: string): string => (process.env[key] ?? "").trim();

export function mailerConfigured(): boolean {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS"));
}

/** Drop the cached connection so the next send re-resolves and re-probes. */
export function resetMailer(): void {
  cached = null;
}

/**
 * Hostnames serving the same mailboxes. The configured host always comes first;
 * the siblings are only used when the configured host does not answer.
 */
function hostVariants(smtpHost: string): string[] {
  const variants = [smtpHost];
  const host = smtpHost.toLowerCase();

  if (host === "email.secureserver.net" || host.endsWith(".secureserver.net")) {
    variants.push("smtpout.secureserver.net", "smtp.secureserver.net");
  }
  if (host.endsWith(".titan.email")) {
    variants.push("smtpout.secureserver.net");
  }

  return [...new Set(variants)];
}

function probe(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (reachable: boolean) => {
      socket.destroy();
      resolve(reachable);
    };
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

/** Candidate endpoints, in order of preference, for the configured server. */
async function endpoints(smtpHost: string, configuredPort: number): Promise<Endpoint[]> {
  const ports = configuredPort === 465 ? [465, 587] : [configuredPort, 465];
  const list: Endpoint[] = [];

  for (const hostname of hostVariants(smtpHost)) {
    let addresses: string[] = [hostname];
    try {
      const records = await dns.lookup(hostname, { all: true });
      if (records.length > 0) addresses = records.map((record) => record.address);
    } catch {
      // Fall back to letting the OS resolve the hostname at connect time.
    }
    for (const address of addresses) {
      for (const port of ports) list.push({ host: address, port, hostname });
    }
  }

  return list;
}

/** Build (once) a transporter bound to a mail server address that answers. */
export async function getTransporter(): Promise<Transporter> {
  if (cached) return cached.transporter;

  const smtpHost = env("SMTP_HOST");
  const configuredPort = Number(env("SMTP_PORT") || 587);
  const options = await endpoints(smtpHost, configuredPort);

  let chosen: Endpoint | undefined;
  try {
    chosen = await Promise.any(
      options.map((option) =>
        probe(option.host, option.port).then((reachable) =>
          reachable ? option : Promise.reject(new Error(`unreachable ${option.host}:${option.port}`)),
        ),
      ),
    );
  } catch {
    // Nothing answered; still attempt the configured endpoint so the real
    // connection error (rather than a probe result) reaches the caller.
    chosen = { host: smtpHost, port: configuredPort, hostname: smtpHost };
    console.warn(`[mailer] no SMTP address answered a probe; falling back to ${smtpHost}:${configuredPort}.`);
  }

  const transporter = nodemailer.createTransport({
    host: chosen.host,
    port: chosen.port,
    secure: chosen.port === 465,
    auth: {
      user: env("SMTP_USER"),
      pass: env("SMTP_PASS"),
    },
    // Connecting by IP keeps SNI/certificate validation on the real hostname.
    tls: { minVersion: "TLSv1.2", servername: chosen.hostname },
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: 30_000,
  });

  console.log(`[mailer] delivering via ${chosen.hostname} (${chosen.host}:${chosen.port})`);
  cached = { transporter, endpoint: chosen };
  return transporter;
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

function isConnectionError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "ESOCKET" || code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ECONNRESET";
}

export async function sendReportEmail(mail: ReportMail): Promise<void> {
  const fromName = env("MAIL_FROM_NAME") || "Happiness Holistic Clinic";
  const from = `${fromName} <${env("SMTP_USER")}>`;

  const message = {
    from,
    to: mail.to,
    replyTo: env("MAIL_REPLY_TO") || env("SMTP_USER"),
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
        contentType: mail.attachmentIsPdf
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ],
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const transporter = await getTransporter();
      await transporter.sendMail(message);
      return;
    } catch (error) {
      // A stale address or a dropped link must not poison the cached
      // transporter: clear it so the next attempt re-resolves and re-probes.
      if (isConnectionError(error) && attempt === 1) {
        console.warn("[mailer] connection failed, re-resolving the mail server and retrying once.");
        resetMailer();
        continue;
      }
      throw error;
    }
  }
}
