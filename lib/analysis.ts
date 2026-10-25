import { prisma } from "@/lib/prisma";
import type { Position } from "@/lib/heatmap";
import { analyzePositions, computeRating, orientForAttack } from "@/lib/metrics";

export type Result = "W" | "D" | "L";

// Tous les matchs d'un joueur, du plus récent au plus ancien, avec analyses calculées.
export async function loadPlayerMatches(userId: string) {
  const rows = await prisma.participation.findMany({
    where: { userId, stats: { isNot: null } },
    include: { match: { include: { pitch: true } }, stats: true },
    orderBy: { match: { startedAt: "desc" } },
  });

  return rows.map((r) => {
    const { lengthM, widthM } = r.match.pitch;
    const positions = orientForAttack(
      (r.positions ?? []) as unknown as Position[],
      r.team,
      lengthM,
      widthM,
    );
    const analysis = analyzePositions(positions, lengthM, widthM, r.match.durationMinutes * 30);
    const stats = r.stats!;
    const rating = computeRating(stats, analysis.role);

    const mine = r.team === "A" ? r.match.scoreA : r.match.scoreB;
    const theirs = r.team === "A" ? r.match.scoreB : r.match.scoreA;
    const result: Result = mine > theirs ? "W" : mine < theirs ? "L" : "D";

    return {
      matchId: r.matchId,
      startedAt: r.match.startedAt,
      team: r.team,
      mine,
      theirs,
      result,
      stats,
      positions,
      analysis,
      rating,
      lengthM,
      widthM,
    };
  });
}
