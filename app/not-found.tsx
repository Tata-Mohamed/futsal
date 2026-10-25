import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-9xl font-black leading-none text-bib">404</p>
      <p className="max-w-xs text-muted">
        Cette page n&apos;existe pas, ou ce match ne fait pas partie de vos matchs.
      </p>
      <Link
        href="/"
        className="rounded-2xl border border-line bg-panel px-5 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bib"
      >
        Retour à mes matchs
      </Link>
    </main>
  );
}
