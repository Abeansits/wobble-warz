import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/ui/ComingSoon";

export const Route = createFileRoute("/ladder")({
  component: () => (
    <ComingSoon title="Ladder" blurb="Twenty preset armies land after the meadow can host a real fight." />
  ),
});
