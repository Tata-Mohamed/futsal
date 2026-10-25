import CountUp from "@/components/CountUp";

// Anneau de progression. L'animation de remplissage est du CSS pur (classe .ring dans globals.css).
export default function ScoreRing({
  value,
  max = 10,
  decimals = 1,
  suffix = "",
  size = 132,
  label,
}: {
  value: number;
  max?: number;
  decimals?: number;
  suffix?: string;
  size?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" strokeWidth="9" />
        <circle
          className="ring"
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--bib)"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          style={{ strokeDashoffset: 100 - pct }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-black leading-none"
          style={{ fontSize: size * 0.36 }}
        >
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        </span>
        {label && <span className="mt-1 text-xs text-muted">{label}</span>}
      </div>
    </div>
  );
}
