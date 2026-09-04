import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/ui/ComingSoon";

export const Route = createFileRoute("/settings")({
  component: () => (
    <ComingSoon
      title="Settings"
      blurb="Volume, shadows, corpse lifetime and screen shake will live here. Defaults are already sensible."
    />
  ),
});
