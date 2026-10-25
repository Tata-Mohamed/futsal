import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { loadPlayerMatches, type Result } from "@/lib/analysis";
import { dateShort, fmt, mean } from "@/lib/format";
import CountUp from "@/components/CountUp";
import Heatmap from "@/components/Heatmap";
import ScoreRing from "@/components/ScoreRing";
import Sparkline from "@/components/Sparkline";

const RESULT_LABEL: Record<Result, string> = { W: "Victoire", D: "Nul", L: "Défaite" };
const RESULT_TEXT: Record<Result, string> = {
  W: "text-emerald-300",
  D: "text-muted",
  L: "text-rose-300",
};
const RESULT_BAR: Record<Result, string> = {
  W: "bg-emerald-400",
  D: "bg-muted",
  L: "bg-rose-400",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.user.findUnique({ where: { id: user.id } });
  const name = profile?.name ?? user.email ?? "Joueur";
  const firstName = name.split(" ")[0];

  const matches = await loadPlayerMatches(user.id); // du plus récent au plus ancien

  const signOut = (
    <form action="/auth/signout" method="post" className="mt-2 text-center">
      <button className="px-4 py-2 text-sm text-muted underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-bib">
        Se déconnecter
      </button>
    </form>
  );

  const header = (
    <header className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted">Salut,</p>
        <h1 className="font-display text-5xl font-extrabold leading-none">{firstName}</h1>
      </div>
      <div
        className="grid h-12 w-12 place-items-center rounded-full bg-bib font-display text-2xl font-black text-ink"
        aria-hidden="true"
      >
        {firstName.charAt(0).toUpperCase()}
      </div>
    </header>
  );

  if (matches.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pb-12 pt-8">
        {header}
        <section className="rounded-[2rem] bg-panel p-6">
          <p className="font-display text-3xl font-extrabold">Pas encore de match</p>
          <p className="mt-2 text-muted">
            Vos stats apparaissent ici dès qu&apos;un match avec capteur est enregistré à votre nom.
          </p>
        </section>
        {signOut}
      </div>
    );
  }

  // --- Agrégats ---
  const chrono = [...matches].reverse();
  const notes = chrono.map((m) => m.rating.note);
  const avg5 = mean(matches.slice(0, 5).map((m) => m.rating.note));
  const prev = matches.slice(5, 10).map((m) => m.rating.note);
  const trend = prev.length ? avg5 - mean(prev) : null;

  const wins = matches.filter((m) => m.result === "W").length;
  const draws = matches.filter((m) => m.result === "D").length;
  const losses = matches.length - wins - draws;
  const winRate = Math.round((wins / matches.length) * 100);

  const totalKm = matches.reduce((s, m) => s + m.stats.distanceM, 0) / 1000;
  const avgKm = totalKm / matches.length;
  const record = matches.reduce((a, b) => (b.stats.maxSpeedKmh > a.stats.maxSpeedKmh ? b : a));
  const best = matches.reduce((a, b) => (b.rating.note > a.rating.note ? b : a));

  const last = matches[0];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-12 pt-8">
      {header}

      {/* Forme : le chiffre héros de la page */}
      <section className="mt-2 rounded-[2rem] bg-panel p-5">
        <p className="text-sm text-muted">Votre forme sur les {Math.min(5, matches.length)} derniers matchs</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="font-display text-[6.5rem] font-black leading-[0.8]">
            <CountUp value={avg5} decimals={1} />
            <span className="ml-1 text-3xl text-muted">/10</span>
          </p>
          {trend !== null && (
            <p
              className={`pb-1 text-right text-sm font-semibold ${trend >= 0 ? "text-emerald-300" : "text-rose-300"}`}
            >
              {trend >= 0 ? "▲" : "▼"} {fmt(Math.abs(trend), 1)}
              <span className="block text-xs font-normal text-muted">vs les 5 précédents</span>
            </p>
          )}
        </div>
        <Sparkline notes={notes.slice(-12)} className="mt-6 h-16" />
        <p className="mt-2 text-xs text-muted">
          Note physique de chaque match, du plus ancien au plus récent.
        </p>
      </section>

      {/* Bento : trois blocs de tailles différentes */}
      <section className="grid grid-cols-2 items-stretch gap-3">
        <div className="row-span-2 flex flex-col items-center justify-between gap-4 rounded-3xl bg-panel p-4">
          <p className="self-start text-sm text-muted">Victoires</p>
          <ScoreRing value={winRate} max={100} decimals={0} suffix="%" size={116} />
          <p className="text-center text-sm">
            <span className="text-emerald-300">{wins} V</span> ·{" "}
            <span className="text-muted">{draws} N</span> ·{" "}
            <span className="text-rose-300">{losses} D</span>
          </p>
        </div>

        <div className="rounded-3xl bg-bib p-4 text-ink">
          <p className="text-sm font-medium">Record de vitesse</p>
          <p className="mt-1 font-display text-5xl font-black leading-none">
            {fmt(record.stats.maxSpeedKmh, 1)}
            <span className="ml-1 text-lg font-bold">km/h</span>
          </p>
          <p className="mt-1 text-xs font-medium">{dateShort(record.startedAt)}</p>
        </div>

        <div className="rounded-3xl bg-panel p-4">
          <p className="text-sm text-muted">Distance totale</p>
          <p className="mt-1 font-display text-5xl font-black leading-none">
            <CountUp value={totalKm} decimals={1} />
            <span className="ml-1 text-lg font-bold text-muted">km</span>
          </p>
          <p className="mt-1 text-xs text-muted">{fmt(avgKm, 1)} km par match</p>
        </div>
      </section>

      {/* Dernier match en avant, sur la pelouse */}
      <Link
        href={`/matches/${last.matchId}`}
        className="block overflow-hidden rounded-[2rem] bg-turf-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bib"
      >
        <Heatmap
          id="heat-last"
          positions={last.positions}
          lengthM={last.lengthM}
          widthM={last.widthM}
          marker={{ x: last.analysis.avgX, y: last.analysis.avgY }}
        />
        <div className="flex items-end justify-between gap-4 p-5">
          <div>
            <p className="text-sm text-chalk/70">Dernier match · {dateShort(last.startedAt)}</p>
            <p className="font-display text-5xl font-extrabold leading-none">
              {last.mine}-{last.theirs}
            </p>
            <p className={`mt-1 text-sm font-semibold ${RESULT_TEXT[last.result]}`}>
              {RESULT_LABEL[last.result]}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-5xl font-black leading-none text-bib">
              {fmt(last.rating.note, 1)}
            </p>
            <p className="text-xs text-chalk/70">note du match</p>
          </div>
        </div>
      </Link>

      {/* Meilleure performance */}
      <Link
        href={`/matches/${best.matchId}`}
        className="flex items-center justify-between rounded-3xl border border-line bg-raised px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bib"
      >
        <div>
          <p className="text-sm text-muted">Votre meilleur match</p>
          <p className="font-semibold">
            {dateShort(best.startedAt)} · {fmt(best.stats.distanceM / 1000, 1)} km
          </p>
        </div>
        <p className="font-display text-4xl font-black text-bib">{fmt(best.rating.note, 1)}</p>
      </Link>

      {/* Historique : une seule liste, pas une carte par match */}
      <section>
        <h2 className="mb-2 font-display text-2xl font-extrabold">Historique</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-panel">
          {matches.map((m) => (
            <li key={m.matchId}>
              <Link
                href={`/matches/${m.matchId}`}
                className="flex items-center gap-4 px-4 py-3.5 transition active:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bib"
              >
                <span className={`h-10 w-1 rounded-full ${RESULT_BAR[m.result]}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-2xl font-extrabold leading-none">
                    {m.mine}-{m.theirs}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {dateShort(m.startedAt)} · {fmt(m.stats.distanceM / 1000, 1)} km ·{" "}
                    {fmt(m.stats.maxSpeedKmh, 1)} km/h
                  </p>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-full border border-line font-display text-xl font-black">
                  {fmt(m.rating.note, 1)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {signOut}
    </div>
  );
}
