import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Position } from "@/lib/heatmap";
import { analyzePositions, computeRating, orientForAttack, ROLE_LABEL } from "@/lib/metrics";
import { dateLong, fmt, mean } from "@/lib/format";
import CountUp from "@/components/CountUp";
import Heatmap from "@/components/Heatmap";
import ScoreRing from "@/components/ScoreRing";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      pitch: { include: { five: true } },
      participations: {
        select: {
          id: true,
          userId: true,
          team: true,
          user: { select: { name: true } },
          stats: true,
        },
      },
    },
  });
  if (!match) notFound();

  // Sécurité : on ne montre que les matchs auxquels on a participé
  const me = match.participations.find((p) => p.userId === user.id);
  if (!me) notFound();
  const s = me.stats;

  // Positions : requête séparée (données lourdes), uniquement pour moi
  const posRow = await prisma.participation.findUnique({
    where: { id: me.id },
    select: { positions: true },
  });
  const { lengthM, widthM } = match.pitch;
  const positions = orientForAttack(
    (posRow?.positions ?? []) as unknown as Position[],
    me.team,
    lengthM,
    widthM,
  );
  const analysis = analyzePositions(positions, lengthM, widthM, match.durationMinutes * 30);

  if (!s) {
    return (
      <div className="mx-auto max-w-md px-5 py-10">
        <Link href="/" className="text-sm text-muted">
          ‹ Mes matchs
        </Link>
        <p className="mt-6 text-muted">Les stats de ce match ne sont pas encore disponibles.</p>
      </div>
    );
  }

  const rating = computeRating(s, analysis.role);

  // --- Classement dans le match ---
  const withStats = match.participations.filter((p) => p.stats);
  const rankOf = (pick: (st: NonNullable<(typeof withStats)[number]["stats"]>) => number) =>
    [...withStats].sort((a, b) => pick(b.stats!) - pick(a.stats!)).findIndex((p) => p.id === me.id) + 1;
  const total = withStats.length;
  const rankDistance = rankOf((st) => st.distanceM);
  const rankSpeed = rankOf((st) => st.maxSpeedKmh);
  const rankSprints = rankOf((st) => st.sprints);

  const best = (pick: (st: NonNullable<(typeof withStats)[number]["stats"]>) => number) =>
    withStats.reduce((a, b) => (pick(b.stats!) > pick(a.stats!) ? b : a));
  const stars = [
    { title: "Le plus endurant", p: best((st) => st.distanceM), value: (x: typeof s) => `${fmt(x.distanceM / 1000, 2)} km` },
    { title: "Le plus rapide", p: best((st) => st.maxSpeedKmh), value: (x: typeof s) => `${fmt(x.maxSpeedKmh, 1)} km/h` },
    { title: "Roi du sprint", p: best((st) => st.sprints), value: (x: typeof s) => `${x.sprints} sprints` },
  ];

  const ranking = [...withStats].sort((a, b) => b.stats!.distanceM - a.stats!.distanceM);
  const maxDist = ranking[0]?.stats!.distanceM || 1;

  // --- Comparaison avec mes autres matchs ---
  const others = await prisma.matchStats.findMany({
    where: { participation: { userId: user.id, matchId: { not: match.id } } },
    select: { distanceM: true, maxSpeedKmh: true, sprints: true, playerLoad: true },
  });
  const compare = others.length
    ? [
        { label: "Distance", now: s.distanceM, avg: mean(others.map((o) => o.distanceM)) },
        { label: "Vitesse max", now: s.maxSpeedKmh, avg: mean(others.map((o) => o.maxSpeedKmh)) },
        { label: "Sprints", now: s.sprints, avg: mean(others.map((o) => o.sprints)) },
        { label: "Charge physique", now: s.playerLoad, avg: mean(others.map((o) => o.playerLoad)) },
      ].map((c) => ({ ...c, delta: c.avg ? Math.round(((c.now - c.avg) / c.avg) * 100) : 0 }))
    : [];

  // --- Zones d'intensité ---
  const zones = [
    { label: "Marche", seconds: s.zoneWalkS, color: "bg-sky-400" },
    { label: "Trot", seconds: s.zoneJogS, color: "bg-emerald-400" },
    { label: "Course", seconds: s.zoneRunS, color: "bg-yellow-400" },
    { label: "Sprint", seconds: s.zoneSprintS, color: "bg-rose-500" },
  ];
  const totalZones = zones.reduce((sum, z) => sum + z.seconds, 0) || 1;

  // --- Répartition sur le terrain ---
  const thirds = [
    { label: "Défense", value: analysis.thirds.def },
    { label: "Milieu", value: analysis.thirds.mid },
    { label: "Attaque", value: analysis.thirds.att },
  ];
  const maxThird = Math.max(...thirds.map((t) => t.value));

  const teamDot = (team: string) => (team === "A" ? "bg-team-a" : "bg-team-b");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 pb-14 pt-6">
      <Link
        href="/"
        className="w-fit text-sm text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bib"
      >
        ‹ Mes matchs
      </Link>

      {/* Tableau d'affichage */}
      <section className="text-center">
        <p className="text-sm capitalize text-muted">{dateLong(match.startedAt)}</p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-right">
            <p className="flex items-center justify-end gap-2 text-sm text-muted">
              Équipe A <span className="h-2.5 w-2.5 rounded-full bg-team-a" />
            </p>
            <p className="font-display text-8xl font-black leading-[0.85]">{match.scoreA}</p>
          </div>
          <p className="font-display text-4xl text-line">:</p>
          <div className="text-left">
            <p className="flex items-center gap-2 text-sm text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-team-b" /> Équipe B
            </p>
            <p className="font-display text-8xl font-black leading-[0.85]">{match.scoreB}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">
          {match.pitch.five.name}, {match.pitch.name}. Vous jouiez en équipe {me.team}.
        </p>
      </section>

      {/* Pelouse pleine largeur */}
      <section className="-mx-5">
        <div className="reveal">
          <Heatmap
            id="heat-main"
            positions={positions}
            lengthM={lengthM}
            widthM={widthM}
            marker={{ x: analysis.avgX, y: analysis.avgY }}
          />
        </div>
        <div className="mx-5 mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p>
            Poste probable : <span className="font-semibold">{ROLE_LABEL[analysis.role]}</span>
          </p>
          <p className="text-muted">Point jaune : votre position moyenne</p>
        </div>
        <p className="mx-5 mt-1 text-xs text-muted">
          Précision limitée : le GPS peut se tromper de 1 à 3 m sur un petit terrain.
        </p>
      </section>

      {/* Répartition sur le terrain */}
      <section className="rounded-3xl bg-panel p-5">
        <h2 className="font-display text-2xl font-extrabold">Où vous avez joué</h2>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-raised">
          {thirds.map((t) => (
            <div
              key={t.label}
              className={t.value === maxThird ? "bg-bib" : "bg-chalk/35"}
              style={{ width: `${t.value}%` }}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 text-sm">
          {thirds.map((t, i) => (
            <p key={t.label} className={i === 1 ? "text-center" : i === 2 ? "text-right" : ""}>
              <span className="font-display text-2xl font-extrabold">{t.value}%</span>
              <span className="block text-xs text-muted">{t.label}</span>
            </p>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
          <p>
            <span className="font-display text-2xl font-extrabold">{analysis.coverage}%</span>
            <span className="block text-xs text-muted">du terrain couvert</span>
          </p>
          <p>
            <span className="font-display text-2xl font-extrabold">
              {analysis.sides.left}/{analysis.sides.right}
            </span>
            <span className="block text-xs text-muted">côté gauche / droit</span>
          </p>
          <p>
            <span className="font-display text-2xl font-extrabold">{analysis.regularity}%</span>
            <span className="block text-xs text-muted">régularité 2e mi-temps</span>
          </p>
        </div>
      </section>

      {/* Note du match */}
      <section className="rounded-3xl bg-panel p-5">
        <h2 className="font-display text-2xl font-extrabold">Note du match</h2>
        <div className="mt-4 flex items-center gap-5">
          <ScoreRing value={rating.note} label="sur 10" size={128} />
          <ul className="flex flex-1 flex-col gap-3">
            {rating.indices.map((ix) => (
              <li key={ix.key}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted">{ix.label}</span>
                  <span className="font-semibold">{ix.value}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
                  <div className="h-full rounded-full bg-bib" style={{ width: `${ix.value}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Note calculée à partir de vos données physiques, comparées à un objectif de référence pour
          votre poste. Elle ne juge pas la qualité technique.
        </p>
      </section>

      {/* Stats : blocs de tailles différentes */}
      <section className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-3xl bg-panel p-5">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted">Distance parcourue</p>
            <p className="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold">
              {rankDistance}e sur {total}
            </p>
          </div>
          <p className="mt-1 font-display text-7xl font-black leading-none">
            <CountUp value={s.distanceM / 1000} decimals={2} />
            <span className="ml-1.5 text-2xl text-muted">km</span>
          </p>
        </div>

        <div className="rounded-3xl bg-bib p-4 text-ink">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium">Vitesse max</p>
            <p className="text-xs font-bold">{rankSpeed}e/{total}</p>
          </div>
          <p className="mt-2 font-display text-6xl font-black leading-none">
            <CountUp value={s.maxSpeedKmh} decimals={1} />
          </p>
          <p className="text-sm font-medium">km/h</p>
        </div>

        <div className="rounded-3xl bg-panel p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted">Sprints</p>
            <p className="text-xs font-bold text-muted">{rankSprints}e/{total}</p>
          </div>
          <p className="mt-2 font-display text-6xl font-black leading-none">
            <CountUp value={s.sprints} />
          </p>
          <p className="text-sm text-muted">{s.sprintDistanceM} m en sprint</p>
        </div>

        <div className="col-span-2 grid grid-cols-3 divide-x divide-line rounded-3xl bg-panel py-4 text-center">
          <p>
            <span className="font-display text-4xl font-black">{s.accelerations}</span>
            <span className="block text-xs text-muted">accélérations</span>
          </p>
          <p>
            <span className="font-display text-4xl font-black">{s.decelerations}</span>
            <span className="block text-xs text-muted">décélérations</span>
          </p>
          <p>
            <span className="font-display text-4xl font-black">{fmt(s.avgSpeedKmh, 1)}</span>
            <span className="block text-xs text-muted">km/h en moyenne</span>
          </p>
        </div>

        <div className="rounded-3xl bg-panel p-4">
          <p className="text-sm text-muted">Charge physique</p>
          <p className="mt-1 font-display text-5xl font-black leading-none">{s.playerLoad}</p>
        </div>
        <div className="rounded-3xl bg-panel p-4">
          <p className="text-sm text-muted">Fréquence cardiaque</p>
          <p className="mt-1 font-display text-5xl font-black leading-none">
            {s.avgHeartRate ?? "-"}
            <span className="ml-1 text-base text-muted">bpm</span>
          </p>
        </div>
      </section>

      {/* Comparaison avec mes autres matchs */}
      {compare.length > 0 && (
        <section className="rounded-3xl bg-panel p-5">
          <h2 className="font-display text-2xl font-extrabold">Par rapport à votre moyenne</h2>
          <ul className="mt-3 divide-y divide-line">
            {compare.map((c) => (
              <li key={c.label} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted">{c.label}</span>
                <span
                  className={`font-semibold ${c.delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                >
                  {c.delta >= 0 ? "▲ +" : "▼ "}
                  {c.delta}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Calculé sur vos {others.length} autres matchs.
          </p>
        </section>
      )}

      {/* Intensité */}
      <section className="rounded-3xl bg-panel p-5">
        <h2 className="font-display text-2xl font-extrabold">Intensité</h2>
        <p className="mt-1 text-sm text-muted">
          {Math.round(rating.hiShare * 100)}% du match à haute intensité (course et sprint).
        </p>
        <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-raised">
          {zones.map((z) => (
            <div
              key={z.label}
              className={z.color}
              style={{ width: `${(z.seconds / totalZones) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted">
          {zones.map((z) => (
            <div key={z.label} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${z.color}`} />
              {z.label} : {Math.round(z.seconds / 60)} min
            </div>
          ))}
        </div>
      </section>

      {/* Stars du match : défilement horizontal */}
      <section>
        <h2 className="mb-3 font-display text-2xl font-extrabold">Les stars du match</h2>
        <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
          {stars.map((st) => (
            <div
              key={st.title}
              className="min-w-[10.5rem] snap-start rounded-3xl border border-line bg-raised p-4"
            >
              <p className="text-xs text-muted">{st.title}</p>
              <p className="mt-2 flex items-center gap-2 font-semibold">
                <span className={`h-2.5 w-2.5 rounded-full ${teamDot(st.p.team)}`} />
                {st.p.userId === user.id ? "Vous" : st.p.user.name}
              </p>
              <p className="mt-1 font-display text-3xl font-black">{st.value(st.p.stats!)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Classement avec barres */}
      <section className="rounded-3xl bg-panel p-5">
        <h2 className="font-display text-2xl font-extrabold">Classement distance</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {ranking.map((p, i) => {
            const isMe = p.userId === user.id;
            return (
              <li key={p.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className={isMe ? "font-bold text-bib" : ""}>
                    {i + 1}. {isMe ? "Vous" : p.user.name}
                  </span>
                  <span className="text-muted">{fmt(p.stats!.distanceM / 1000, 2)} km</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised">
                  <div
                    className={`h-full rounded-full ${p.team === "A" ? "bg-team-a" : "bg-team-b"} ${isMe ? "" : "opacity-60"}`}
                    style={{ width: `${(p.stats!.distanceM / maxDist) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-team-a" /> Équipe A
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-team-b" /> Équipe B
          </span>
        </p>
      </section>
    </div>
  );
}
