export type Position = { t: number; x: number; y: number };

// Découpe le terrain en cases et compte combien de positions tombent dans chacune.
// Résultat normalisé : 1 = case la plus fréquentée, 0 = jamais visitée.
export function buildHeatGrid(
  positions: Position[],
  lengthM: number,
  widthM: number,
  cellM = 0.5,
) {
  const cols = Math.ceil(lengthM / cellM);
  const rows = Math.ceil(widthM / cellM);
  const grid = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (const p of positions) {
    const c = Math.min(cols - 1, Math.max(0, Math.floor(p.x / cellM)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(p.y / cellM)));
    grid[r][c]++;
  }

  const max = Math.max(...grid.flat(), 1);
  return { cellM, cells: grid.map((row) => row.map((v) => v / max)) };
}
