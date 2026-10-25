// Génère des données de démo : 1 five, 1 terrain, 12 joueurs, 1 gérant, 15 matchs.
// Relançable à volonté : il supprime d'abord les anciennes données de démo.
import "dotenv/config";

import { PrismaClient, Prisma, Role, Plan, TeamSide } from "@prisma/client";
import {
  simulateMatch,
  mulberry32,
  PITCH_L,
  PITCH_W,
  Profile,
} from "./simulate";

const prisma = new PrismaClient();
const rand = mulberry32(2026);
const between = (a: number, b: number) => a + (b - a) * rand();

const NAMES = [
  "Mohamed",
  "Yanis",
  "Lucas",
  "Karim",
  "Hugo",
  "Sofiane",
  "Nabil",
  "Enzo",
  "Théo",
  "Amine",
  "Rayan",
  "Mathis",
];

const FIVE_NAME = "Five Demo Arena";
const MATCH_COUNT = 15;
const DURATION_S = 40 * 60; // 40 minutes

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function clean() {
  await prisma.match.deleteMany({ where: { source: "demo" } });
  await prisma.user.deleteMany({ where: { isDemo: true } });
  await prisma.five.deleteMany({ where: { name: FIVE_NAME } });
}

async function main() {
  console.log("Nettoyage des anciennes données de démo...");
  await clean();

  const five = await prisma.five.create({
    data: { name: FIVE_NAME, city: "Nîmes", indoor: false },
  });
  const pitch = await prisma.pitch.create({
    data: {
      fiveId: five.id,
      name: "Terrain 1",
      lengthM: PITCH_L,
      widthM: PITCH_W,
    },
  });

  await prisma.user.create({
    data: {
      id: "demo-manager",
      email: "demo-manager@five-stats.local",
      name: "Gérant Démo",
      role: Role.MANAGER,
      isDemo: true,
      managedFiveId: five.id,
    },
  });

  const players = NAMES.map((name, i) => ({
    id:
      i === 0 && process.env.DEMO_USER_ID
        ? process.env.DEMO_USER_ID
        : `demo-player-${i + 1}`,
    email:
      i === 0 && process.env.DEMO_EMAIL
        ? process.env.DEMO_EMAIL
        : `demo${i + 1}@five-stats.local`,
    name,
    profile: {
      fitness: between(0.85, 1.15),
      topSpeed: between(5.0, 6.8),
    } as Profile,
  }));

  await prisma.user.createMany({
    data: players.map((p, i) => ({
      id: p.id,
      email: p.email,
      name: p.name,
      role: Role.PLAYER,
      plan: i % 4 === 0 ? Plan.PREMIUM : Plan.FREE,
      isDemo: true,
    })),
  });

  const now = Date.now();
  for (let m = 0; m < MATCH_COUNT; m++) {
    // 10 joueurs parmi 12 : les 5 premiers = équipe A, les 5 suivants = équipe B
    const lineup = shuffle(players).slice(0, 10);
    const results = simulateMatch(
      lineup.map((p) => p.profile),
      DURATION_S,
      rand,
    );

    // Un match tous les ~3 jours, vers 20h
    const day = new Date(now - (MATCH_COUNT - m) * 3 * 24 * 3600 * 1000);
    day.setHours(20, 0, 0, 0);

    const scoreA = Math.max(0, Math.round(5 + (rand() - 0.5) * 6));
    const scoreB = Math.max(0, Math.round(5 + (rand() - 0.5) * 6));

    await prisma.match.create({
      data: {
        pitchId: pitch.id,
        startedAt: day,
        durationMinutes: DURATION_S / 60,
        scoreA,
        scoreB,
        source: "demo",
        participations: {
          create: lineup.map((p, i) => ({
            userId: p.id,
            team: i < 5 ? TeamSide.A : TeamSide.B,
            positions: results[i].positions as unknown as Prisma.InputJsonValue,
            stats: { create: results[i].stats },
          })),
        },
      },
    });
    console.log(`Match ${m + 1}/${MATCH_COUNT} créé (${scoreA}-${scoreB})`);
  }

  console.log("Terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
