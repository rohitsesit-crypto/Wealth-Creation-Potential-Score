/**
 * SMTP self-check:  npm run smtp:check
 *
 * Runs the full pre-flight for report delivery:
 *   1. Print the SMTP settings loaded from `.env.local` (never the password).
 *   2. Resolve the SMTP host and list the IP addresses it resolves to, so a
 *      stale/decommissioned mail-server IP (which shows up as ETIMEDOUT) is
 *      immediately visible.
 *   3. Probe TCP reachability for ports 587 and 465 on the resolved address.
 *   4. Verify the credentials with the mail server and print its exact answer.
 */

import { readFileSync } from "node:fs";
import { lookup } from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import nodemailer from "nodemailer";

const envPath = path.join(process.cwd(), ".env.local");

function loadEnv(file) {
  const out = {};
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function probeTcp(host, port, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done("open"));
    socket.once("timeout", () => done("timeout"));
    socket.once("error", (error) => done(error.code ?? "error"));
  });
}

const fileEnv = loadEnv(envPath);
const read = (key) => (fileEnv[key] ?? process.env[key] ?? "").trim();

const host = read("SMTP_HOST");
const port = Number(read("SMTP_PORT") || 587);
const user = read("SMTP_USER");
const pass = read("SMTP_PASS");
const fromName = read("MAIL_FROM_NAME") || "Happiness Holistic Clinic";

console.log(`env file      : ${envPath}`);
console.log(`SMTP_HOST     : ${host || "(empty)"}`);
console.log(`SMTP_PORT     : ${port}`);
console.log(`SMTP_USER     : ${user || "(empty)"}`);
console.log(`SMTP_PASS     : ${pass ? `set (${pass.length} characters)` : "(empty)"}`);
console.log(`MAIL_FROM_NAME: ${fromName}`);

if (!host) {
  console.error("\nFAILED: SMTP_HOST is not set in .env.local.");
  process.exit(1);
}

/** Hostnames serving the same mailboxes; siblings are tried if the host hangs. */
function hostVariants(smtpHost) {
  const variants = [smtpHost];
  const lower = smtpHost.toLowerCase();
  if (lower === "email.secureserver.net" || lower.endsWith(".secureserver.net")) {
    variants.push("smtpout.secureserver.net", "smtp.secureserver.net");
  }
  if (lower.endsWith(".titan.email")) {
    variants.push("smtpout.secureserver.net");
  }
  return [...new Set(variants)];
}

console.log("\n--- DNS ---");
const resolved = {};
for (const hostname of hostVariants(host)) {
  try {
    const addresses = (await lookup(hostname, { all: true })).map((entry) => entry.address);
    resolved[hostname] = addresses;
    console.log(`${hostname} resolves to: ${addresses.length ? addresses.join(", ") : "(none)"}`);
  } catch (error) {
    resolved[hostname] = [];
    console.log(`${hostname} -> DNS FAILED (${error?.code ?? error?.message})`);
  }
}

console.log("\n--- TCP reachability ---");
const openEndpoints = [];
for (const [hostname, addresses] of Object.entries(resolved)) {
  for (const address of addresses.length ? addresses : [hostname]) {
    for (const candidatePort of [465, 587]) {
      const result = await probeTcp(address, candidatePort);
      if (result === "open") {
        openEndpoints.push({ hostname, address, port: candidatePort });
        console.log(`${hostname} (${address}:${candidatePort}) -> OPEN`);
      } else {
        console.log(`${hostname} (${address}:${candidatePort}) -> NOT REACHABLE (${result})`);
      }
    }
  }
}

if (openEndpoints.length === 0) {
  console.error(
    "\nFAILED: no SMTP address accepted a connection from this machine.\n" +
      "The network/firewall is blocking outbound SMTP (ports 465/587) or the host's\n" +
      "DNS points at a decommissioned mail server. Flush the DNS cache and retry:\n" +
      "  macOS : sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder\n" +
      "  Linux : sudo systemd-resolve --flush-caches\n" +
      "  Windows: ipconfig /flushdns",
  );
  process.exit(1);
}

const preferred =
  openEndpoints.find((entry) => entry.hostname === host && entry.port === port) ??
  openEndpoints.find((entry) => entry.hostname === host) ??
  openEndpoints.find((entry) => entry.port === port) ??
  openEndpoints[0];

if (preferred.hostname !== host || preferred.port !== port) {
  console.warn(
    `\nNote: ${host}:${port} did not answer from here, but the mailboxes are also\n` +
      `served by ${preferred.hostname}. The app now falls back to it automatically.`,
  );
}

if (port !== 465 && !openEndpoints.some((entry) => entry.port === port)) {
  console.warn(
    `\nNote: port ${port} is not reachable from here, but port 465 is. ` +
      "Consider setting SMTP_PORT=465 in .env.local.",
  );
}

if (!user || !pass) {
  console.error(
    "\nFAILED: SMTP_USER and SMTP_PASS must both be set in .env.local.\n" +
      "An empty SMTP_PASS is the usual reason the form shows a 535 authentication error.",
  );
  process.exit(1);
}

if (/[^\x20-\x7e]/.test(pass)) {
  console.warn(
    "\nNote: SMTP_PASS contains a non-ASCII character. Prefer an alphanumeric password.",
  );
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  tls: { minVersion: "TLSv1.2" },
});

try {
  await transporter.verify();
  console.log("\nOK: the mail server accepted the connection and the credentials.");
} catch (error) {
  const code = error?.code;
  console.error(
    `\nFAILED: ${code ?? "ERROR"} ${error?.responseCode ?? ""} ${error?.response ?? error?.message ?? ""}`,
  );

  if (code === "EAUTH") {
    console.error(
      "\nWhat a 535 means here:\n" +
        "  - SMTP_USER must be the full mailbox address (e.g. heal@drvrushali.com).\n" +
        "  - The password must be the mailbox password, not a webmail login PIN.\n" +
        "  - In the Titan panel, confirm SMTP access and (re)set the mailbox password.\n" +
        "  - Re-copy the password, then restart the Next.js server.",
    );
  } else if (code === "ESOCKET" || code === "ETIMEDOUT" || code === "ECONNECTION") {
    console.error(
      "\nThe server could not be reached. Check the host name, the port (587 or 465)\n" +
        "and whether the network / firewall allows outbound SMTP.",
    );
  }
  process.exit(1);
}
