// Simulation de match de five (5 contre 5) et calcul des stats GPS.
// Fichier pur : aucune dépendance à la base de données.

export const PITCH_L = 25;
export const PITCH_W = 15;

export type Pt = { x: number; y: number };
export type Profile = { fitness: number; topSpeed: number }; // topSpeed en m/s

export type PlayerStats = {
  distanceM: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  sprints: number;
  sprintDistanceM: number;
  accelerations: number;
  decelerations: number;
  playerLoad: number;
  avgHeartRate: number;
  zoneWalkS: number;
  zoneJogS: number;
  zoneRunS: number;
  zoneSprintS: number;
};

export type SimResult = {
  stats: PlayerStats;
  positions: { t: number; x: number; y: number }[];
};

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

// Postes : 0 gardien, 1 défenseur, 2 milieu gauche, 3 milieu droit, 4 attaquant
const HOME: Pt[] = [
  { x: 2, y: 7.5 },
  { x: 7, y: 7.5 },
  { x: 12, y: 3.5 },
  { x: 12, y: 11.5 },
  { x: 18, y: 7.5 },
];

// Joueurs 0-4 = équipe A (attaque vers la droite), 5-9 = équipe B (miroir)
function homeOf(i: number): Pt {
  const base = HOME[i % 5];
  return i < 5 ? base : { x: PITCH_L - base.x, y: PITCH_W - base.y };
}

// Simule `profiles.length` joueurs (10 pour un 5v5) sur `durationS` secondes.
// Positions stockées toutes les `sampleEveryS` secondes avec un bruit GPS.
export function simulateMatch(
  profiles: Profile[],
  durationS: number,
  rand: () => number,
  sampleEveryS = 5,
  gpsNoiseM = 0.6,
): SimResult[] {
  const between = (a: number, b: number) => a + (b - a) * rand();
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (!u) u = rand();
    while (!v) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const n = profiles.length;
  const pos: Pt[] = profiles.map((_, i) => homeOf(i));
  const speed: number[] = new Array(n).fill(0);
  const speeds: number[][] = profiles.map(() => []);
  const stored: { t: number; x: number; y: number }[][] = profiles.map(() => []);

  let ball: Pt = { x: PITCH_L / 2, y: PITCH_W / 2 };
  let target: Pt = { ...ball };
  let timer = 0;

  for (let t = 0; t < durationS; t++) {
    if (timer-- <= 0) {
      target = { x: between(1, PITCH_L - 1), y: between(1, PITCH_W - 1) };
      timer = Math.floor(between(3, 9));
    }
    const bdx = target.x - ball.x;
    const bdy = target.y - ball.y;
    const bd = Math.hypot(bdx, bdy) || 1;
    const bstep = Math.min(bd, 8);
    ball = { x: ball.x + (bdx / bd) * bstep, y: ball.y + (bdy / bd) * bstep };

    const fatigue = 1 - 0.12 * (t / durationS);

    for (let i = 0; i < n; i++) {
      const role = i % 5;
      const home = homeOf(i);
      const p = profiles[i];
      let tx: number;
      let ty: number;
      if (role === 0) {
        tx = home.x;
        ty = 7.5 + (ball.y - 7.5) * 0.5;
        tx += gauss() * 0.2;
        ty += gauss() * 0.3;
      } else {
        tx = home.x * 0.55 + ball.x * 0.45 + gauss() * 0.8;
        ty = home.y * 0.55 + ball.y * 0.45 + gauss() * 0.8;
      }

      const dx = tx - pos[i].x;
      const dy = ty - pos[i].y;
      const d = Math.hypot(dx, dy);
      const cruise = 2.2 * p.fitness * fatigue;
      const vmax = p.topSpeed * fatigue;

      let want: number;
      if (d < 0.5) want = 0;
      else if (d < 3) want = cruise * (0.3 + d / 3);
      else {
        want = cruise * 1.4 + (vmax - cruise * 1.4) * Math.min(1, (d - 3) / 5) * (0.5 + 0.5 * rand());
        if (d > 5 && rand() < 0.35) want = vmax; // sprint de pointe
      }
      if (role === 0) want = Math.min(want, 3.5);
      want = Math.max(0, clamp(want, speed[i] - 3.5, speed[i] + 3));

      const move = Math.min(want, d);
      const nx = clamp(pos[i].x + (dx / (d || 1)) * move, 0, PITCH_L);
      const ny = clamp(pos[i].y + (dy / (d || 1)) * move, 0, PITCH_W);
      const real = Math.hypot(nx - pos[i].x, ny - pos[i].y);
      pos[i] = { x: nx, y: ny };
      speed[i] = real;
      speeds[i].push(real);

      if (t % sampleEveryS === 0) {
        stored[i].push({
          t,
          x: round(clamp(nx + gauss() * gpsNoiseM, 0, PITCH_L), 2),
          y: round(clamp(ny + gauss() * gpsNoiseM, 0, PITCH_W), 2),
        });
      }
    }
  }

  return speeds.map((s, i) => ({
    stats: computeStats(s, rand, gauss),
    positions: stored[i],
  }));
}

// Seuils (m/s) : marche < 2, trot < 3.5, course < 4.5, sprint >= 4.5 (16 km/h, adapté au loisir)
export function computeStats(
  speeds: number[],
  rand: () => number,
  gauss: () => number,
): PlayerStats {
  const SPRINT = 4.5;
  let dist = 0;
  let max = 0;
  let sprints = 0;
  let sprintDist = 0;
  let acc = 0;
  let dec = 0;
  let load = 0;
  let walk = 0;
  let jog = 0;
  let run = 0;
  let spr = 0;
  let run2 = 0; // secondes consécutives au-dessus du seuil sprint

  for (let i = 0; i < speeds.length; i++) {
    const v = speeds[i];
    dist += v;
    max = Math.max(max, v);
    if (v < 2) walk++;
    else if (v < 3.5) jog++;
    else if (v < SPRINT) run++;
    else spr++;

    if (v >= SPRINT) {
      run2++;
      sprintDist += v;
      if (run2 === 1) sprints++;
    } else run2 = 0;

    if (i > 0) {
      const a = v - speeds[i - 1];
      load += Math.abs(a) * 0.4 + v * 0.05;
      if (a > 2.2) acc++;
      if (a < -2.2) dec++;
    }
  }

  const durationS = speeds.length || 1;
  const hr = clamp(Math.round(128 + 28 * Math.min(1, dist / 4500) + gauss() * 5), 110, 190);

  return {
    distanceM: Math.round(dist),
    maxSpeedKmh: round(max * 3.6, 1),
    avgSpeedKmh: round((dist / durationS) * 3.6, 1),
    sprints,
    sprintDistanceM: Math.round(sprintDist),
    accelerations: acc,
    decelerations: dec,
    playerLoad: Math.round(load),
    avgHeartRate: hr,
    zoneWalkS: walk,
    zoneJogS: jog,
    zoneRunS: run,
    zoneSprintS: spr,
  };
}
