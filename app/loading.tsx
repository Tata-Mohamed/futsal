export default function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pb-12 pt-8" aria-busy="true">
      <div className="h-12 w-40 animate-pulse rounded-xl bg-panel" />
      <div className="h-56 animate-pulse rounded-[2rem] bg-panel" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-40 animate-pulse rounded-3xl bg-panel" />
        <div className="h-40 animate-pulse rounded-3xl bg-panel" />
      </div>
      <div className="h-64 animate-pulse rounded-[2rem] bg-turf-deep/60" />
    </div>
  );
}
