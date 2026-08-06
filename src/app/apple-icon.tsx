import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#18181B",
          borderRadius: 40,
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64" fill="none">
          <rect x="14" y="34" width="8" height="16" rx="2" fill="#FAFAFA" />
          <rect x="28" y="24" width="8" height="26" rx="2" fill="#FAFAFA" />
          <rect x="42" y="14" width="8" height="36" rx="2" fill="#60A5FA" />
          <circle cx="47" cy="16" r="6" fill="#34D399" />
          <path
            d="M44.2 16.1l1.8 1.8 3.4-3.6"
            stroke="#052e1f"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
