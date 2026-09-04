export function makeFaceAtlas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#00000000";
  g.fillRect(0, 0, 256, 64);

  const draw = (i: number, kind: "idle" | "angry" | "hurt" | "dead") => {
    const x = i * 64;
    g.save();
    g.translate(x + 32, 32);
    g.fillStyle = "#1c1710";
    if (kind === "dead") {
      g.lineWidth = 5;
      g.strokeStyle = "#1c1710";
      g.beginPath();
      g.moveTo(-14, -8);
      g.lineTo(-4, 2);
      g.moveTo(-4, -8);
      g.lineTo(-14, 2);
      g.moveTo(4, -8);
      g.lineTo(14, 2);
      g.moveTo(14, -8);
      g.lineTo(4, 2);
      g.stroke();
      g.beginPath();
      g.arc(0, 14, 6, 0, Math.PI);
      g.stroke();
    } else if (kind === "hurt") {
      g.beginPath();
      g.ellipse(-10, -4, 5, 3, 0, 0, Math.PI * 2);
      g.ellipse(10, -4, 5, 3, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(0, 12, 8, 6, 0, Math.PI, Math.PI * 2);
      g.fill();
    } else if (kind === "angry") {
      g.beginPath();
      g.moveTo(-16, -10);
      g.lineTo(-4, -2);
      g.lineTo(-16, -2);
      g.closePath();
      g.moveTo(16, -10);
      g.lineTo(4, -2);
      g.lineTo(16, -2);
      g.closePath();
      g.fill();
      g.fillRect(-6, 8, 12, 5);
    } else {
      g.beginPath();
      g.arc(-10, -4, 4.5, 0, Math.PI * 2);
      g.arc(10, -4, 4.5, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(0, 8, 8, 0.15 * Math.PI, 0.85 * Math.PI);
      g.lineWidth = 4;
      g.strokeStyle = "#1c1710";
      g.stroke();
    }
    g.restore();
  };

  draw(0, "idle");
  draw(1, "angry");
  draw(2, "hurt");
  draw(3, "dead");
  return c;
}
