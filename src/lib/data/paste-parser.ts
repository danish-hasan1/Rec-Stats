import type { SubmitterType } from "@/types/db";

export type ParsedRow = {
  source: SubmitterType;
  submitterName: string;
  roleName: string;
  submissions: number;
  interviewL1: number;
  interviewL2: number;
  interviewL3: number;
  raw: string;
};

export type ParseResult = {
  date: string | null;
  rows: ParsedRow[];
  warnings: string[];
};

const HEADER_ALIASES: Record<string, string[]> = {
  source: ["source"],
  name: ["name"],
  role: ["role"],
  submissions: ["submissions", "submission", "subs"],
  interview: ["interview", "interviews", "interview stage", "stage"],
};

function splitCells(line: string): string[] {
  // recruiters paste tab-separated (from Excel/Sheets); fall back to 2+ spaces.
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  return line.split(/ {2,}/).map((c) => c.trim());
}

function parseDate(cell: string): string | null {
  const trimmed = cell.trim();
  // dd/mm/yyyy
  let m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd
  m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return trimmed;
  return null;
}

function normalizeSource(cell: string): SubmitterType | null {
  const v = cell.trim().toLowerCase();
  if (v === "recruiter" || v === "rec") return "recruiter";
  if (v === "vendor") return "vendor";
  return null;
}

// Maps a free-text interview stage (as pasted) to an L1/L2/L3 bucket.
// Returns null when the text doesn't match any recognized stage.
function parseInterviewLevel(cell: string): 1 | 2 | 3 | null {
  const v = cell.trim().toLowerCase();
  if (!v) return null;
  if (/\bl\s*1\b/.test(v) || v === "1") return 1;
  if (/\bl\s*2\b/.test(v) || v === "2") return 2;
  if (/\bl\s*3\b/.test(v) || v === "3" || /final/.test(v)) return 3;
  return null;
}

export function parsePastedBlock(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/ /g, " "))
    .filter((l) => l.trim().length > 0);

  const warnings: string[] = [];
  let date: string | null = null;
  let headerIdx = -1;
  let colMap: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const cells = splitCells(lines[i]);
    if (!date) {
      const maybeDate = parseDate(cells[0] ?? "");
      if (maybeDate) {
        date = maybeDate;
        continue;
      }
    }
    // look for header row
    const lower = cells.map((c) => c.trim().toLowerCase());
    const found: Record<string, number> = {};
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      const idx = lower.findIndex((c) => aliases.includes(c));
      if (idx !== -1) found[key] = idx;
    }
    if (found.source !== undefined && found.name !== undefined && found.role !== undefined) {
      headerIdx = i;
      colMap = found;
      break;
    }
  }

  if (headerIdx === -1) {
    warnings.push(
      "No header row found (expected columns: Source, Name, Role, Submissions, Interview)."
    );
    return { date, rows: [], warnings };
  }
  if (!date) {
    warnings.push("No date line found above the header — pick a date manually.");
  }

  const rows: ParsedRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = splitCells(lines[i]);
    if (cells.every((c) => c === "")) continue;

    const sourceRaw = cells[colMap.source] ?? "";
    const source = normalizeSource(sourceRaw);
    const submitterName = (cells[colMap.name] ?? "").trim();
    const roleName = (cells[colMap.role] ?? "").trim();
    const submissionsRaw = (cells[colMap.submissions] ?? "").trim();
    const interviewRaw =
      colMap.interview !== undefined ? (cells[colMap.interview] ?? "").trim() : "";

    if (!submitterName && !roleName) continue;

    if (!source) {
      warnings.push(`Row "${lines[i]}": unrecognized Source "${sourceRaw}" (expected recruiter/vendor) — skipped.`);
      continue;
    }
    if (!roleName) {
      warnings.push(`Row "${lines[i]}": missing Role — skipped.`);
      continue;
    }

    const submissions = submissionsRaw === "" ? 0 : parseInt(submissionsRaw, 10);
    if (Number.isNaN(submissions)) {
      warnings.push(`Row "${lines[i]}": submissions "${submissionsRaw}" is not a number — treated as 0.`);
    }

    const level = interviewRaw ? parseInterviewLevel(interviewRaw) : null;
    if (interviewRaw && !level) {
      warnings.push(
        `Row "${lines[i]}": interview stage "${interviewRaw}" not recognized (expected L1/L2/L3/Final) — ignored.`
      );
    }

    rows.push({
      source,
      submitterName,
      roleName,
      submissions: Number.isNaN(submissions) ? 0 : submissions,
      interviewL1: level === 1 ? 1 : 0,
      interviewL2: level === 2 ? 1 : 0,
      interviewL3: level === 3 ? 1 : 0,
      raw: lines[i],
    });
  }

  return { date, rows, warnings };
}
