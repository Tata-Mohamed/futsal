import { buildHeatGrid, type Position } from "@/lib/heatmap";

// Heatmap sur une pelouse tondue en bandes. Les positions doivent être orientées
// (attaque vers la droite). `marker` = position moyenne (optionnelle).
export default function Heatmap({
  positions,
  lengthM,
  widthM,
  id = "heat",
  marker,
}: {
  positions: Position[];
  lengthM: number;
  widthM: number;
  id?: string;
  marker?: { x: number; y: number };
}) {
  const { cells, cellM } = buildHeatGrid(positions, lengthM, widthM);
  const stripes = 10;
  const stripeW = lengthM / stripes;

  return (
    <svg
      viewBox={`0 0 ${lengthM} ${widthM}`}
      className="block w-full"
      role="img"
      aria-label="Heatmap de vos déplacements, attaque vers la droite"
    >
      <defs>
        <filter id={`${id}-blur`} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="0.55" />
        </filter>
      </defs>

      <rect width={lengthM} height={widthM} fill="#145f3f" />
      {Array.from({ length: stripes }).map((_, i) =>
        i % 2 === 0 ? (
          <rect key={i} x={i * stripeW} y={0} width={stripeW} height={widthM} fill="#176b47" />
        ) : null,
      )}

      <g filter={`url(#${id}-blur)`}>
        {cells.flatMap((row, r) =>
          row.map((v, c) => {
            if (v < 0.04) return null;
            const t = Math.sqrt(v);
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cellM}
                y={r * cellM}
                width={cellM}
                height={cellM}
                fill={`hsl(${Math.round(200 - 195 * t)} 95% 55%)`}
                opacity={Math.min(0.85, t * 1.15)}
              />
            );
          }),
        )}
      </g>

      <g fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.1">
        <rect x="0.05" y="0.05" width={lengthM - 0.1} height={widthM - 0.1} />
        <line x1={lengthM / 2} y1="0" x2={lengthM / 2} y2={widthM} />
        <circle cx={lengthM / 2} cy={widthM / 2} r="2" />
        <rect x="0" y={widthM / 2 - 3.5} width="4" height="7" />
        <rect x={lengthM - 4} y={widthM / 2 - 3.5} width="4" height="7" />
      </g>

      {marker && (
        <g>
          <circle cx={marker.x} cy={marker.y} r="1.7" fill="none" stroke="#e8f04a" strokeOpacity="0.55" strokeWidth="0.12" />
          <circle cx={marker.x} cy={marker.y} r="0.7" fill="#e8f04a" stroke="#0e1322" strokeWidth="0.18" />
        </g>
      )}

      {/* Sens de l'attaque */}
      <path
        d={`M ${lengthM - 7} ${widthM - 1.1} h 4.2 m -1.2 -0.9 l 1.2 0.9 l -1.2 0.9`}
        fill="none"
        stroke="white"
        strokeOpacity="0.6"
        strokeWidth="0.16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
