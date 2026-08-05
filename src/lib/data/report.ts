import ExcelJS from "exceljs";
import type { EntryView } from "@/types/db";

export type ReportRow = EntryView & { role_status: string };

const BRAND = "FF18181B"; // near-black header band, matches the app's dark UI accents
const HEADER_TEXT = "FFFFFFFF";
const BAND = "FFF4F4F5"; // subtle zebra stripe
const BORDER = "FFE4E4E7";

const STATUS_FILL: Record<string, string> = {
  open: "FFDCFCE7", // green
  deal: "FFDDE9FE", // blue
  on_hold: "FFFEF3C7", // amber
  cancelled: "FFF1F1F1", // gray
  lost: "FFFEE2E2", // red
};

const thinBorder = {
  top: { style: "thin" as const, color: { argb: BORDER } },
  left: { style: "thin" as const, color: { argb: BORDER } },
  bottom: { style: "thin" as const, color: { argb: BORDER } },
  right: { style: "thin" as const, color: { argb: BORDER } },
};

export async function buildReportWorkbook(rows: ReportRow[], title: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rec Stats";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title.slice(0, 31) || "Report", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  const columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Source", key: "source", width: 12 },
    { header: "Name", key: "name", width: 18 },
    { header: "Role", key: "role", width: 30 },
    { header: "Role Status", key: "role_status", width: 14 },
    { header: "Submissions", key: "submissions", width: 13 },
    { header: "L1", key: "l1", width: 7 },
    { header: "L2", key: "l2", width: 7 },
    { header: "L3", key: "l3", width: 7 },
    { header: "Deal Recruiter", key: "deal_recruiter", width: 18 },
    { header: "Notes", key: "notes", width: 24 },
  ];
  const lastCol = String.fromCharCode(64 + columns.length); // "K"

  // Setting `.columns` writes header text into row 1 as a side effect — apply it
  // first so the title band we write next ends up as the final content there.
  sheet.columns = columns;

  // Title band
  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: HEADER_TEXT } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 26;
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };

  sheet.mergeCells(`A2:${lastCol}2`);
  const subtitleCell = sheet.getCell("A2");
  const generated = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  subtitleCell.value = `${rows.length} row${rows.length === 1 ? "" : "s"} — generated ${generated}`;
  subtitleCell.font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  sheet.getRow(2).height = 18;

  // Row 3 stays blank as a spacer between the title band and the header.

  const headerRow = sheet.getRow(4);
  headerRow.values = columns.map((c) => c.header);
  headerRow.font = { bold: true, color: { argb: HEADER_TEXT } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.eachCell((cell) => {
    cell.border = thinBorder;
  });
  headerRow.height = 20;

  rows.forEach((r, i) => {
    const row = sheet.addRow({
      date: r.date,
      source: r.submitter_type,
      name: r.submitter_name,
      role: r.role_name,
      role_status: r.role_status.replace("_", " "),
      submissions: r.submissions,
      l1: r.interview_l1,
      l2: r.interview_l2,
      l3: r.interview_l3,
      deal_recruiter: r.deal_recruiter_name ?? "",
      notes: r.notes ?? "",
    });

    const banded = i % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (banded) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND } };
    });

    const statusFill = STATUS_FILL[r.role_status];
    if (statusFill) {
      const statusCell = row.getCell("role_status");
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
    }

    ["submissions", "l1", "l2", "l3"].forEach((key) => {
      row.getCell(key).alignment = { horizontal: "right" };
    });
  });

  const totalsRow = sheet.addRow({
    date: "",
    source: "",
    name: "",
    role: "",
    role_status: "Total",
    submissions: rows.reduce((s, r) => s + r.submissions, 0),
    l1: rows.reduce((s, r) => s + r.interview_l1, 0),
    l2: rows.reduce((s, r) => s + r.interview_l2, 0),
    l3: rows.reduce((s, r) => s + r.interview_l3, 0),
    deal_recruiter: "",
    notes: "",
  });
  totalsRow.font = { bold: true };
  totalsRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { ...thinBorder, top: { style: "double", color: { argb: "FF9CA3AF" } } };
  });
  ["submissions", "l1", "l2", "l3"].forEach((key) => {
    totalsRow.getCell(key).alignment = { horizontal: "right" };
  });

  sheet.autoFilter = { from: "A4", to: `${lastCol}4` };

  return workbook;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadReport(rows: ReportRow[], title: string, filename: string) {
  const workbook = await buildReportWorkbook(rows, title);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}

const CSV_HEADERS = [
  "Date",
  "Source",
  "Name",
  "Role",
  "Role Status",
  "Submissions",
  "L1",
  "L2",
  "L3",
  "Deal Recruiter",
  "Notes",
];

function csvEscape(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadReportCsv(rows: ReportRow[], filename: string) {
  const lines = [
    CSV_HEADERS.join(","),
    ...rows.map((r) =>
      [
        r.date,
        r.submitter_type,
        r.submitter_name,
        r.role_name,
        r.role_status.replace("_", " "),
        r.submissions,
        r.interview_l1,
        r.interview_l2,
        r.interview_l3,
        r.deal_recruiter_name ?? "",
        r.notes ?? "",
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}
