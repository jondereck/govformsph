import React from "react";

/** Official GovFormsPH mark. Field concept: blue G, yellow blank, red stop. */
export const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 256 256"
    className={className}
    role="img"
    aria-label="GovFormsPH"
  >
    <path
      fill="none"
      stroke="#0038A8"
      strokeWidth="40"
      strokeLinecap="round"
      d="M178 62A78 78 0 1 0 178 194"
    />
    <rect x="112" y="112" width="86" height="34" rx="8" fill="#FCD116" />
    <rect x="176" y="112" width="30" height="34" rx="8" fill="#CE1126" />
  </svg>
);
