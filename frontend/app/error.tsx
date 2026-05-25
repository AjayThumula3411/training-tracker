"use client";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-white/10 p-6 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-200">
          Something went wrong
        </p>
        <h1 className="mt-3 text-2xl font-bold">
          Training Tracker could not load this view.
        </h1>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
