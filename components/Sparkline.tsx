// Petit histogramme des notes de match (de la plus ancienne à la plus récente).
export default function Sparkline({
  notes,
  className = "",
}: {
  notes: number[];
  className?: string;
}) {
  return (
    <div
      className={`flex items-end gap-1.5 ${className}`}
      role="img"
      aria-label="Évolution de vos notes de match"
    >
      {notes.map((n, i) => (
        <div
          key={i}
          title={String(n)}
          className={`flex-1 rounded-t-md ${i === notes.length - 1 ? "bg-bib" : "bg-raised"}`}
          style={{ height: `${Math.max(12, n * 10)}%` }}
        />
      ))}
    </div>
  );
}
