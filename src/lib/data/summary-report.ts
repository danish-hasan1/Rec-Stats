import ExcelJS from "exceljs";
import type { ConversionRates, DealStats, Totals } from "@/lib/data/aggregate";
import { BAND, BRAND, HEADER_TEXT, csvEscape, thinBorder, triggerDownload } from "@/lib/data/report-style";

export type SummaryReportRow = {
  label: string;
  sublabel?: string;
  totals: Totals;
  rates: ConversionRates;
  deal: DealStats;
};

export type SummaryReportInput = {
  reportTitle: string; // e.g. "Weekly Summary"
  labelHeader: string; // e.g. "Week"
  sublabelHeader?: string; // e.g. "Type" for recruiter reports
  filterLine: string; // date range + filters applied, shown as subtitle
  rows: SummaryReportRow[];
};

function fmtPct(v: number | null) {
  return v === null ? "—" : `${Math.round(v)}%`;
}

export async function buildSummaryReportWorkbook(input: SummaryReportInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rec Stats";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(input.reportTitle.slice(0, 31) || "Summary", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  const columns = [
    { header: input.labelHeader, key: "label", width: 24 },
    ...(input.sublabelHeader ? [{ header: input.sublabelHeader, key: "sublabel", width: 12 }] : []),
    { header: "Subs", key: "subs", width: 9 },
    { header: "L1", key: "l1", width: 7 },
    { header: "L2", key: "l2", width: 7 },
    { header: "L3", key: "l3", width: 7 },
    { header: "Subs → L1", key: "sub_l1", width: 11 },
    { header: "L1 → L2", key: "l1_l2", width: 11 },
    { header: "L2 → L3", key: "l2_l3", width: 11 },
    { header: "Subs → L2", key: "sub_l2", width: 11 },
    { header: "Deals", key: "deals", width: 8 },
    { header: "Deal Ratio", key: "deal_ratio", width: 11 },
  ];
  const lastCol = String.fromCharCode(64 + columns.length);
  sheet.columns = columns;

  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = input.reportTitle;
  titleCell.font = { bold: true, size: 14, color: { argb: HEADER_TEXT } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 26;
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };

  sheet.mergeCells(`A2:${lastCol}2`);
  const subtitleCell = sheet.getCell("A2");
  const generated = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  subtitleCell.value = `${input.filterLine} · Generated ${generated}`;
  subtitleCell.font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  sheet.getRow(2).height = 18;
  // Row 3 stays blank as a spacer.

  const headerRow = sheet.getRow(4);
  headerRow.values = columns.map((c) => c.header);
  headerRow.font = { bold: true, color: { argb: HEADER_TEXT } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.eachCell((cell) => {
    cell.border = thinBorder;
  });
  headerRow.height = 20;

  const numericKeys = ["subs", "l1", "l2", "l3", "sub_l1", "l1_l2", "l2_l3", "sub_l2", "deals", "deal_ratio"];

  input.rows.forEach((r, i) => {
    const row = sheet.addRow({
      label: r.label,
      sublabel: r.sublabel ?? "",
      subs: r.totals.totalSubs,
      l1: r.totals.interviewL1,
      l2: r.totals.interviewL2,
      l3: r.totals.interviewL3,
      sub_l1: fmtPct(r.rates.subToL1),
      l1_l2: fmtPct(r.rates.l1ToL2),
      l2_l3: fmtPct(r.rates.l2ToL3),
      sub_l2: fmtPct(r.rates.subToL2),
      deals: r.deal.deals,
      deal_ratio: fmtPct(r.deal.ratio),
    });
    const banded = i % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder;
      if (banded) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND } };
    });
    numericKeys.forEach((key) => {
      row.getCell(key).alignment = { horizontal: "right" };
    });
  });

  if (input.rows.length > 0) {
    const totals = input.rows.reduce(
      (acc, r) => ({
        subs: acc.subs + r.totals.totalSubs,
        l1: acc.l1 + r.totals.interviewL1,
        l2: acc.l2 + r.totals.interviewL2,
        l3: acc.l3 + r.totals.interviewL3,
        deals: acc.deals + r.deal.deals,
        roles: acc.roles + r.deal.roles,
      }),
      { subs: 0, l1: 0, l2: 0, l3: 0, deals: 0, roles: 0 }
    );
    const totalsRow = sheet.addRow({
      label: "Total",
      sublabel: "",
      subs: totals.subs,
      l1: totals.l1,
      l2: totals.l2,
      l3: totals.l3,
      sub_l1: fmtPct(totals.subs > 0 ? (totals.l1 / totals.subs) * 100 : null),
      l1_l2: fmtPct(totals.l1 > 0 ? (totals.l2 / totals.l1) * 100 : null),
      l2_l3: fmtPct(totals.l2 > 0 ? (totals.l3 / totals.l2) * 100 : null),
      sub_l2: fmtPct(totals.subs > 0 ? (totals.l2 / totals.subs) * 100 : null),
      deals: totals.deals,
      deal_ratio: fmtPct(totals.roles > 0 ? (totals.deals / totals.roles) * 100 : null),
    });
    totalsRow.font = { bold: true };
    totalsRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { ...thinBorder, top: { style: "double", color: { argb: "FF9CA3AF" } } };
    });
    numericKeys.forEach((key) => {
      totalsRow.getCell(key).alignment = { horizontal: "right" };
    });
  }

  sheet.autoFilter = { from: "A4", to: `${lastCol}4` };

  return workbook;
}

export async function downloadSummaryReport(input: SummaryReportInput, filename: string) {
  const workbook = await buildSummaryReportWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename);
}

export function downloadSummaryReportCsv(input: SummaryReportInput, filename: string) {
  const headers = [
    input.labelHeader,
    ...(input.sublabelHeader ? [input.sublabelHeader] : []),
    "Subs",
    "L1",
    "L2",
    "L3",
    "Subs to L1",
    "L1 to L2",
    "L2 to L3",
    "Subs to L2",
    "Deals",
    "Deal Ratio",
  ];
  const lines = [headers.join(",")];
  input.rows.forEach((r) => {
    const cells = [
      r.label,
      ...(input.sublabelHeader ? [r.sublabel ?? ""] : []),
      r.totals.totalSubs,
      r.totals.interviewL1,
      r.totals.interviewL2,
      r.totals.interviewL3,
      fmtPct(r.rates.subToL1),
      fmtPct(r.rates.l1ToL2),
      fmtPct(r.rates.l2ToL3),
      fmtPct(r.rates.subToL2),
      r.deal.deals,
      fmtPct(r.deal.ratio),
    ];
    lines.push(cells.map(csvEscape).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
}
