// Positions for the relationship map: a small force-directed layout (linked notes pull together, every note pushes
// the others away), run a fixed number of steps so the same volume always gets the same picture.

export type GraphNode = { id: string; x: number; y: number };

export function layoutGraph(ids: string[], edges: [string, string][], width = 1000, height = 700): GraphNode[] {
  const count = ids.length;
  if (count === 0) return [];

  // Start on a circle, so the result doesn't depend on randomness.
  const nodes = ids.map((id, i) => ({
    id,
    x: width / 2 + (width / 3) * Math.cos((2 * Math.PI * i) / count),
    y: height / 2 + (height / 3) * Math.sin((2 * Math.PI * i) / count),
    dx: 0,
    dy: 0,
  }));
  const index = new Map(ids.map((id, i) => [id, i]));
  const ideal = Math.sqrt((width * height) / count) * 0.75;

  for (let step = 0, heat = width / 10; step < 300; step++, heat *= 0.985) {
    for (const node of nodes) {
      node.dx = 0;
      node.dy = 0;
    }
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dx = a.x - b.x || 0.01;
        const dy = a.y - b.y || 0.01;
        const dist = Math.hypot(dx, dy);
        const push = (ideal * ideal) / dist;
        a.dx += (dx / dist) * push;
        a.dy += (dy / dist) * push;
        b.dx -= (dx / dist) * push;
        b.dy -= (dy / dist) * push;
      }
    }
    for (const [from, to] of edges) {
      const a = nodes[index.get(from)!]!;
      const b = nodes[index.get(to)!]!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const pull = (dist * dist) / ideal;
      a.dx -= (dx / dist) * pull;
      a.dy -= (dy / dist) * pull;
      b.dx += (dx / dist) * pull;
      b.dy += (dy / dist) * pull;
    }
    for (const node of nodes) {
      const moved = Math.hypot(node.dx, node.dy) || 1;
      node.x += (node.dx / moved) * Math.min(moved, heat);
      node.y += (node.dy / moved) * Math.min(moved, heat);
      // A gentle pull to the middle keeps unconnected notes from drifting off.
      node.x += (width / 2 - node.x) * 0.01;
      node.y += (height / 2 - node.y) * 0.01;
    }
  }

  return nodes.map(({ id, x, y }) => ({ id, x, y }));
}
