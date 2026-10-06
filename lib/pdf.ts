/**
 * Converts the filled DOCX report into a PDF.
 *
 * The conversion uses LibreOffice in headless mode, which is the only
 * open-source engine that preserves the template's layout. If LibreOffice is
 * not installed on the host, we return null and the caller sends the Word
 * document instead — the email is never blocked by a missing converter.
 */

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CANDIDATE_BINARIES = [
  process.env.LIBREOFFICE_BIN,
  "soffice",
  "libreoffice",
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
].filter(Boolean) as string[];

function resolveBinary(): string | null {
  for (const candidate of CANDIDATE_BINARIES) {
    if (candidate.includes("/")) {
      if (existsSync(candidate)) return candidate;
    } else {
      return candidate; // rely on PATH lookup at exec time
    }
  }
  return null;
}

export async function convertDocxToPdf(
  docx: Buffer,
  fileStem: string,
): Promise<{ pdf: Buffer; fileName: string } | null> {
  const binary = resolveBinary();
  if (!binary) return null;

  const dir = await mkdtemp(path.join(tmpdir(), "wcps-"));
  try {
    const docxPath = path.join(dir, `${fileStem}.docx`);
    await writeFile(docxPath, docx);

    await execFileAsync(
      binary,
      ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, docxPath],
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
    );

    const pdfPath = path.join(dir, `${fileStem}.pdf`);
    const pdf = await readFile(pdfPath);
    return { pdf, fileName: `${fileStem}.pdf` };
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
