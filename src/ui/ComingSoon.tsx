import { Link } from "@tanstack/react-router";

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-meadow-deep px-6 text-center text-cream">
      <h1 className="font-display text-5xl">{title}</h1>
      <p className="max-w-md text-lg text-cream/80">{blurb}</p>
      <div className="flex gap-3">
        <Link
          to="/"
          className="toy-shadow rounded-btn border-[3px] border-ink bg-cream px-4 py-2 font-display text-ink"
        >
          Title
        </Link>
        <Link
          to="/battle"
          className="toy-shadow rounded-btn border-[3px] border-ink bg-ochre-hot px-4 py-2 font-display text-ink"
        >
          Play now
        </Link>
      </div>
    </main>
  );
}
