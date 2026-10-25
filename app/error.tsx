"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-4xl font-extrabold">Le chargement a échoué</p>
      <p className="max-w-xs text-muted">
        Vos données sont intactes. Vérifiez votre connexion puis réessayez.
      </p>
      <button
        onClick={reset}
        className="rounded-2xl bg-bib px-5 py-3 font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chalk"
      >
        Réessayer
      </button>
    </main>
  );
}
