import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const BattleApp = lazy(() =>
  import("@/game/render/BattleApp").then((m) => ({ default: m.BattleApp })),
);

export const Route = createFileRoute("/battle")({
  ssr: false,
  component: BattlePage,
});

function BattlePage() {
  return (
    <div className="h-dvh w-full overflow-hidden bg-meadow-deep">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center font-display text-3xl text-cream">
            Loading the meadow…
          </div>
        }
      >
        <BattleApp />
      </Suspense>
    </div>
  );
}
