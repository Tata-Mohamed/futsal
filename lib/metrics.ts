import type { Position } from "@/lib/heatmap";

export type Role = "GK" | "DEF" | "MID" | "ATT";

export const ROLE_LABEL: Record<Role, string> = {
  GK: "Gardien",
  DEF: "Défenseur",
  MID: "Milieu",
  ATT: "Attaquant",
};

export type StatsLike = {
  distanceM: number;
  maxSpeedKmh: number;
  sprints: number;
  playerLoad: number;
  zoneWalkS: number;
  zoneJogS: number;
  zoneRunS: number;
  zoneSprintS: number;
};

// Les capteurs enregistrent les positions dans le repère du terrain.
// L'équipe A attaque vers la droite, l'équipe B vers la gauche : on retourne les positions
// de l'équipe B pour que, à l'écran, TOUT LE MONDE attaque vers la droite.
export function orientForAttack(
  positions: Position[],
  team: "A" | "B",
  lengthM: number,
  widthM: number,
): Position[] {
  if (team === "A") return positions;
  return positions.map((p) => ({ t: p.t, x: lengthM - p.x, y: widthM - p.y }));
}

export type PositionAnalysis = {
  avgX: number;
  avgY: number;
  role: Role;
  thirds: { def: number; mid: number; att: number }; // en %
  sides: { left: number; right: number }; // en %, dans le sens de l'attaque
  coverage: number; // % du terrain parcouru
  regularity: number; // % : effort 2e mi-temps / 1re mi-temps (plafonné à 100)
};

const EMPTY: PositionAnalysis = {
  avgX: 0,
  avgY: 0,
  role: "MID",
  thirds: { def: 33, mid: 34, att: 33 },
  sides: { left: 50, right: 50 },
  coverage: 0,
  regularity: 100,
};

// `positions` doivent déjà être orientées (attaque vers la droite).
export function analyzePositions(
  positions: Position[],
  lengthM: number,
  widthM: number,
  halfTimeS: number,
): PositionAnalysis {
  if (positions.length === 0) return EMPTY;

  const cellM = 2.5;
  const cols = Math.ceil(lengthM / cellM);
  const rows = Math.ceil(widthM / cellM);
  const counts = new Map<number, number>();

  let sx = 0;
  let sy = 0;
  let def = 0;
  let mid = 0;
  let left = 0;
  let path1 = 0;
  let path2 = 0;

  positions.forEach((p, i) => {
    sx += p.x;
    sy += p.y;

    const share = p.x / lengthM;
    if (share < 1 / 3) def++;
    else if (share < 2 / 3) mid++;

    // Face à l'attaque (vers la droite de l'écran), la gauche est en haut (y petit)
    if (p.y < widthM / 2) left++;

    const c = Math.min(cols - 1, Math.max(0, Math.floor(p.x / cellM)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(p.y / cellM)));
    const key = r * cols + c;
    counts.set(key, (counts.get(key) ?? 0) + 1);

    if (i > 0) {
      const d = Math.hypot(p.x - positions[i - 1].x, p.y - positions[i - 1].y);
      if (p.t < halfTimeS) path1 += d;
      else path2 += d;
    }
  });

  const n = positions.length;
  const avgX = sx / n;
  const avgY = sy / n;
  const progress = avgX / lengthM;

  // Poste probable d'après la position moyenne sur le terrain (heuristique)
  const role: Role = progress < 0.2 ? "GK" : progress < 0.435 ? "DEF" : progress < 0.555 ? "MID" : "ATT";

  const defPct = Math.round((def / n) * 100);
  const midPct = Math.round((mid / n) * 100);
  const leftPct = Math.round((left / n) * 100);

  let visited = 0;
  counts.forEach((v) => {
    if (v >= 2) visited++;
  });

  return {
    avgX,
    avgY,
    role,
    thirds: { def: defPct, mid: midPct, att: Math.max(0, 100 - defPct - midPct) },
    sides: { left: leftPct, right: 100 - leftPct },
    coverage: Math.round((visited / (cols * rows)) * 100),
    regularity: path1 > 0 ? Math.min(100, Math.round((path2 / path1) * 100)) : 100,
  };
}

// Objectifs de référence pour un match d'environ 40 minutes (à ajuster avec de vraies données)
const TARGETS = {
  field: { dist: 4800, vmax: 25, sprints: 20, hi: 0.1, load: 1400 },
  gk: { dist: 1800, vmax: 18, sprints: 4, hi: 0.02, load: 700 },
};

export type RatingIndex = { key: string; label: string; value: number }; // value en %

export type Rating = { note: number; indices: RatingIndex[]; hiShare: number };

const cap = (v: number) => Math.max(0, Math.min(1, v));

// Note physique /10 : moyenne pondérée de 5 indices, chacun mesuré par rapport à un objectif.
export function computeRating(s: StatsLike, role: Role): Rating {
  const t = role === "GK" ? TARGETS.gk : TARGETS.field;
  const totalZone = s.zoneWalkS + s.zoneJogS + s.zoneRunS + s.zoneSprintS || 1;
  const hiShare = (s.zoneRunS + s.zoneSprintS) / totalZone;

  const endurance = cap(s.distanceM / t.dist);
  const intensite = cap(hiShare / t.hi);
  const repetition = cap(s.sprints / t.sprints);
  const pointe = cap(s.maxSpeedKmh / t.vmax);
  const charge = cap(s.playerLoad / t.load);

  // Un gardien n'est pas censé enchaîner les sprints : on pèse moins l'intensité et la répétition
  const w =
    role === "GK"
      ? { endurance: 0.45, intensite: 0.1, repetition: 0.1, pointe: 0.15, charge: 0.2 }
      : { endurance: 0.3, intensite: 0.2, repetition: 0.2, pointe: 0.15, charge: 0.15 };

  const score =
    endurance * w.endurance +
    intensite * w.intensite +
    repetition * w.repetition +
    pointe * w.pointe +
    charge * w.charge;

  const pct = (v: number) => Math.round(v * 100);
  return {
    note: Math.round(score * 100) / 10,
    hiShare,
    indices: [
      { key: "endurance", label: "Endurance", value: pct(endurance) },
      { key: "intensite", label: "Intensité", value: pct(intensite) },
      { key: "repetition", label: "Répétition des efforts", value: pct(repetition) },
      { key: "pointe", label: "Vitesse de pointe", value: pct(pointe) },
      { key: "charge", label: "Charge physique", value: pct(charge) },
    ],
  };
}
