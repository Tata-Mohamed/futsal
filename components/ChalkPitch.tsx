// Terrain tracé à la craie, utilisé comme décor. Pur SVG, aucun JavaScript côté navigateur.
export default function ChalkPitch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 160"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.35"
      strokeLinecap="round"
    >
      <rect className="draw" pathLength={1} x="6" y="6" width="88" height="148" rx="1" />
      <line className="draw" pathLength={1} style={{ animationDelay: "0.5s" }} x1="6" y1="80" x2="94" y2="80" />
      <circle className="draw" pathLength={1} style={{ animationDelay: "0.8s" }} cx="50" cy="80" r="14" />
      <rect className="draw" pathLength={1} style={{ animationDelay: "1.1s" }} x="28" y="6" width="44" height="22" />
      <rect className="draw" pathLength={1} style={{ animationDelay: "1.1s" }} x="28" y="132" width="44" height="22" />
      <rect className="draw" pathLength={1} style={{ animationDelay: "1.3s" }} x="39" y="6" width="22" height="8" />
      <rect className="draw" pathLength={1} style={{ animationDelay: "1.3s" }} x="39" y="146" width="22" height="8" />
    </svg>
  );
}