import { strToU8, zipSync } from "fflate";
import type { ArtifactFile, QaFix, ValidationReport } from "@/lib/types";

export const GROUPS = ["staging", "marts", "analysis · docs · config"] as const;
export type Group = (typeof GROUPS)[number];

export function groupOf(f: ArtifactFile): Group {
  if (f.filename.includes("/staging/")) return "staging";
  if (f.filename.includes("/marts/")) return "marts";
  return "analysis · docs · config";
}

export function basename(path: string) {
  return path.split("/").at(-1) ?? path;
}

export type Mark = "critical" | "warning";

/**
 * Which files QA has something to say about. Fixes name their file exactly; other findings name files
 * by basename in their (deterministic) message, so a basename match is enough.
 */
export function marksFor(files: ArtifactFile[], report: ValidationReport | null): Map<string, Mark> {
  const marks = new Map<string, Mark>();
  if (!report) return marks;
  for (const fix of report.fixes) if (!fix.applied) marks.set(fix.file, "critical");
  for (const check of report.checks) {
    if (check.passed) continue;
    const mark: Mark = check.severity === "critical" ? "critical" : "warning";
    for (const f of files) {
      const name = basename(f.filename);
      const model = name.replace(/\.(sql|yml|md)$/, "");
      if (check.message.includes(name) || (f.kind === "test" && check.message.includes(model))) {
        if (marks.get(f.filename) !== "critical") marks.set(f.filename, mark);
      }
    }
  }
  return marks;
}

/** The unapplied fix for a file, if QA has one. */
export function fixFor(file: string, report: ValidationReport | null): QaFix | undefined {
  return report?.fixes.find((f) => f.file === file && !f.applied);
}

/** A dbt project folder: models and analyses where dbt expects them, docs beside them. */
export function projectZip(files: ArtifactFile[], name: string): Blob {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    const path = f.kind === "sql" && !f.filename.startsWith("analyses/") ? `analyses/${basename(f.filename)}` : f.filename;
    entries[`${name}/${path}`] = strToU8(f.content.endsWith("\n") ? f.content : `${f.content}\n`);
  }
  return new Blob([zipSync(entries)], { type: "application/zip" });
}
