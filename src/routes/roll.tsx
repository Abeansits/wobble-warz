import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/ui/ComingSoon";

export const Route = createFileRoute("/roll")({
  component: () => (
    <ComingSoon title="Roll" blurb="The capsule machine needs credits, and credits need finished battles." />
  ),
});
