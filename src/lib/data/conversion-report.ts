import ExcelJS from "exceljs";
import type { ConversionRates, DealStats, Totals } from "@/lib/data/aggregate";
import { BAND, BRAND, HEADER_TEXT, STATUS_FILL, csvEscape, thinBorder, triggerDownload } from "@/lib/data/report-style";

export type RoleConversionRow = {
  name: string;
  status: string;
  closedByName: string | null;
  totals: Totals;
  rates: ConversionRates;
};

export type RecruiterConversionRow = {
  name: string;
  type: string;
  totals: Totals;
  rates: ConversionRates;
  deal: DealStats;
};

export type ConversionReportInput = {
  from: string;
  to: string;
  roleFilterName: string | null;
  recruiterFilterName: string | null;
  summary: {
    totals: Totals;
    rates: ConversionRates;
    deal: DealStats;
  };
  byRole: RoleConversionRow[];
  byRecruiter: RecruiterConversionRow[];
};

function fmtPct(v: number | null) {
  return v === null ? "—" : `${Math.round(v)}%`;
}

function titleBand(sheet: ExcelJS.Worksheet, lastCol: string, title: string, subtitle: string) {
  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: HEADER_TEXT } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 26;
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };

  sheet.mergeCells(`A2:${lastCol}2`);
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = subtitle;
  subtitleCell.font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  sheet.getRow(2).height = 18;
  // Row 3 stays blank as a spacer between the title band and the header.
}

function headerRow(sheet: ExcelJS.Worksheet, columns: { header: string }[]) {
  const row = sheet.getRow(4);
  row.values = columns.map((c) => c.header);
  row.font = { bold: true, color: { argb: HEADER_TEXT } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  row.alignment = { vertical: "middle" };
  row.eachCell((cell) => {
    cell.border = thinBorder;
  });
  row.height = 20;
}

export async function buildConversionReportWorkbook(input: ConversionReportInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rec Stats";
  workbook.created = new Date();

  const generated = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const filterLine = `Role: ${input.roleFilterName ?? "All roles"} · Recruiter: ${input.recruiterFilterName ?? "All recruiters"} · Generated ${generated}`;

  // ---------- Summary ----------
  const summarySheet = workbook.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 4 }] });
  const summaryColumns = [
    { header: "Metric", key: "metric", width: 26 },
    { header: "Value", key: "value", width: 20 },
  ];
  summarySheet.columns = summaryColumns;
  titleBand(summarySheet, "B", `Conversion Report — ${input.from} to ${input.to}`, filterLine);
  headerRow(summarySheet, summaryColumns);

  const { totals, rates, deal } = input.summary;
  const summaryRows: [string, string | number][] = [
    ["Submissions", totals.totalSubs],
    ["Interviews L1", totals.interviewL1],
    ["Interviews L2", totals.interviewL2],
    ["Interviews L3", totals.interviewL3],
    ["Subs → L1", fmtPct(rates.subToL1)],
    ["L1 → L2", fmtPct(rates.l1ToL2)],
    ["L2 → L3", fmtPct(rates.l2ToL3)],
    ["Subs → L2", fmtPct(rates.subToL2)],
    ["Roles touched", deal.roles],
    ["Deals closed", deal.deals],
    ["Deal ratio (deals / roles)", fmtPct(deal.ratio)],
  ];
  summaryRows.forEach(([metric, value], i) => {
    const row = summarySheet.addRow({ metric, value });
    row.getCell("value").alignment = { horizontal: "right" };
    const banded = i % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (banded) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND } };
    });
  });
  const dealRatioRow = summarySheet.lastRow;
  if (dealRatioRow) dealRatioRow.font = { bold: true };

  // ---------- By Role ----------
  const roleSheet = workbook.addWorksheet("By Role", { views: [{ state: "frozen", ySplit: 4 }] });
  const roleColumns = [
    { header: "Role", key: "role", width: 30 },
    { header: "Status", key: "status", width: 12 },
    { header: "Closed By", key: "closed_by", width: 18 },
    { header: "Subs", key: "subs", width: 9 },
    { header: "L1", key: "l1", width: 7 },
    { header: "L2", key: "l2", width: 7 },
    { header: "L3", key: "l3", width: 7 },
    { header: "Subs → L1", key: "sub_l1", width: 11 },
    { header: "L1 → L2", key: "l1_l2", width: 11 },
    { header: "Subs → L2", key: "sub_l2", width: 11 },
  ];
  const roleLastCol = String.fromCharCode(64 + roleColumns.length); // "J"
  roleSheet.columns = roleColumns;
  titleBand(roleSheet, roleLastCol, "Role-wise Conversion", filterLine);
  headerRow(roleSheet, roleColumns);

  input.byRole.forEach((r, i) => {
    const row = roleSheet.addRow({
      role: r.name,
      status: r.status.replace("_", " "),
      closed_by: r.closedByName ?? "",
      subs: r.totals.totalSubs,
      l1: r.totals.interviewL1,
      l2: r.totals.interviewL2,
      l3: r.totals.interviewL3,
      sub_l1: fmtPct(r.rates.subToL1),
      l1_l2: fmtPct(r.rates.l1ToL2),
      sub_l2: fmtPct(r.rates.subToL2),
    });
    const banded = i % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (banded) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND } };
    });
    const statusFill = STATUS_FILL[r.status];
    if (statusFill) row.getCell("status").fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
    ["subs", "l1", "l2", "l3", "sub_l1", "l1_l2", "sub_l2"].forEach((key) => {
      row.getCell(key).alignment = { horizontal: "right" };
    });
  });
  roleSheet.autoFilter = { from: "A4", to: `${roleLastCol}4` };

  // ---------- By Recruiter ----------
  const recruiterSheet = workbook.addWorksheet("By Recruiter", { views: [{ state: "frozen", ySplit: 4 }] });
  const recruiterColumns = [
    { header: "Name", key: "name", width: 20 },
    { header: "Type", key: "type", width: 12 },
    { header: "Subs", key: "subs", width: 9 },
    { header: "L1", key: "l1", width: 7 },
    { header: "L2", key: "l2", width: 7 },
    { header: "L3", key: "l3", width: 7 },
    { header: "Roles", key: "roles", width: 8 },
    { header: "Deals", key: "deals", width: 8 },
    { header: "Deal Ratio", key: "deal_ratio", width: 11 },
    { header: "Subs → L1", key: "sub_l1", width: 11 },
    { header: "L1 → L2", key: "l1_l2", width: 11 },
    { header: "Subs → L2", key: "sub_l2", width: 11 },
  ];
  const recruiterLastCol = String.fromCharCode(64 + recruiterColumns.length); // "L"
  recruiterSheet.columns = recruiterColumns;
  titleBand(recruiterSheet, recruiterLastCol, "Recruiter-wise Conversion", filterLine);
  headerRow(recruiterSheet, recruiterColumns);

  input.byRecruiter.forEach((r, i) => {
    const row = recruiterSheet.addRow({
      name: r.name,
      type: r.type,
      subs: r.totals.totalSubs,
      l1: r.totals.interviewL1,
      l2: r.totals.interviewL2,
      l3: r.totals.interviewL3,
      roles: r.deal.roles,
      deals: r.deal.deals,
      deal_ratio: fmtPct(r.deal.ratio),
      sub_l1: fmtPct(r.rates.subToL1),
      l1_l2: fmtPct(r.rates.l1ToL2),
      sub_l2: fmtPct(r.rates.subToL2),
    });
    const banded = i % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (banded) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND } };
    });
    ["subs", "l1", "l2", "l3", "roles", "deals", "deal_ratio", "sub_l1", "l1_l2", "sub_l2"].forEach((key) => {
      row.getCell(key).alignment = { horizontal: "right" };
    });
  });
  recruiterSheet.autoFilter = { from: "A4", to: `${recruiterLastCol}4` };

  return workbook;
}

export async function downloadConversionReport(input: ConversionReportInput, filename: string) {
  const workbook = await buildConversionReportWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}

export function downloadConversionReportCsv(input: ConversionReportInput, filename: string) {
  const lines: string[] = [];

  lines.push(`Conversion Report,${input.from} to ${input.to}`);
  lines.push(`Role,${input.roleFilterName ?? "All roles"},Recruiter,${input.recruiterFilterName ?? "All recruiters"}`);
  lines.push("");

  lines.push("Summary");
  lines.push("Metric,Value");
  const { totals, rates, deal } = input.summary;
  const summaryRows: [string, string | number][] = [
    ["Submissions", totals.totalSubs],
    ["Interviews L1", totals.interviewL1],
    ["Interviews L2", totals.interviewL2],
    ["Interviews L3", totals.interviewL3],
    ["Subs to L1", fmtPct(rates.subToL1)],
    ["L1 to L2", fmtPct(rates.l1ToL2)],
    ["L2 to L3", fmtPct(rates.l2ToL3)],
    ["Subs to L2", fmtPct(rates.subToL2)],
    ["Roles touched", deal.roles],
    ["Deals closed", deal.deals],
    ["Deal ratio", fmtPct(deal.ratio)],
  ];
  summaryRows.forEach(([metric, value]) => lines.push([metric, value].map(csvEscape).join(",")));
  lines.push("");

  lines.push("By Role");
  lines.push(["Role", "Status", "Closed By", "Subs", "L1", "L2", "L3", "Subs to L1", "L1 to L2", "Subs to L2"].join(","));
  input.byRole.forEach((r) => {
    lines.push(
      [
        r.name,
        r.status.replace("_", " "),
        r.closedByName ?? "",
        r.totals.totalSubs,
        r.totals.interviewL1,
        r.totals.interviewL2,
        r.totals.interviewL3,
        fmtPct(r.rates.subToL1),
        fmtPct(r.rates.l1ToL2),
        fmtPct(r.rates.subToL2),
      ]
        .map(csvEscape)
        .join(",")
    );
  });
  lines.push("");

  lines.push("By Recruiter");
  lines.push(
    ["Name", "Type", "Subs", "L1", "L2", "L3", "Roles", "Deals", "Deal Ratio", "Subs to L1", "L1 to L2", "Subs to L2"].join(",")
  );
  input.byRecruiter.forEach((r) => {
    lines.push(
      [
        r.name,
        r.type,
        r.totals.totalSubs,
        r.totals.interviewL1,
        r.totals.interviewL2,
        r.totals.interviewL3,
        r.deal.roles,
        r.deal.deals,
        fmtPct(r.deal.ratio),
        fmtPct(r.rates.subToL1),
        fmtPct(r.rates.l1ToL2),
        fmtPct(r.rates.subToL2),
      ]
        .map(csvEscape)
        .join(",")
    );
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}
