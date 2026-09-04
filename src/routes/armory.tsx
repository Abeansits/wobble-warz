import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/ui/ComingSoon";

export const Route = createFileRoute("/armory")({
  component: () => (
    <ComingSoon title="Armory" blurb="Hats, palettes, and a 3D turntable come with the roster expansion." />
  ),
});
