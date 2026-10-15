import type { LucideProps } from 'lucide-react';

/** Envelopes: a donut chart, drawn in the Lucide style. */
export function DonutIcon({ size = 24, strokeWidth = 2, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 8.5V3" />
      <path d="m8.97 13.75-4.76 2.75" />
      <path d="m15.03 13.75 4.76 2.75" />
    </svg>
  );
}
