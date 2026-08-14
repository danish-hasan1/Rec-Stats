// Shared Excel styling so every report (raw entries, conversion stats, …)
// looks like one product instead of ad-hoc spreadsheets.

export const BRAND = "FF18181B"; // near-black header band, matches the app's dark UI accents
export const HEADER_TEXT = "FFFFFFFF";
export const BAND = "FFF4F4F5"; // subtle zebra stripe
export const BORDER = "FFE4E4E7";
export const ACCENT_FILL = "FFDDE9FE"; // soft blue, for callout/summary cells

export const STATUS_FILL: Record<string, string> = {
  open: "FFDCFCE7", // green
  deal: "FFDDE9FE", // blue
  on_hold: "FFFEF3C7", // amber
  cancelled: "FFF1F1F1", // gray
  lost: "FFFEE2E2", // red
};

export const thinBorder = {
  top: { style: "thin" as const, color: { argb: BORDER } },
  left: { style: "thin" as const, color: { argb: BORDER } },
  bottom: { style: "thin" as const, color: { argb: BORDER } },
  right: { style: "thin" as const, color: { argb: BORDER } },
};

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function csvEscape(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
