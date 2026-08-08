export interface TeamPalette {
  bgSoft: string;
  text: string;
  border: string;
  ring: string;
  dot: string;
  hex: string;
}

// Every literal class string a team could use must appear verbatim here so Tailwind's
// static scanner generates it — class names built by runtime string interpolation
// (e.g. `bg-team-${n}`) are invisible to Tailwind and silently produce no styles.
const PALETTES: TeamPalette[] = [
  { bgSoft: "bg-team-a/15", text: "text-team-a", border: "border-team-a", ring: "ring-team-a", dot: "bg-team-a", hex: "#22d3ee" },
  { bgSoft: "bg-team-b/15", text: "text-team-b", border: "border-team-b", ring: "ring-team-b", dot: "bg-team-b", hex: "#f472b6" },
  { bgSoft: "bg-team-c/15", text: "text-team-c", border: "border-team-c", ring: "ring-team-c", dot: "bg-team-c", hex: "#a3e635" },
  { bgSoft: "bg-team-d/15", text: "text-team-d", border: "border-team-d", ring: "ring-team-d", dot: "bg-team-d", hex: "#fb923c" },
];

export function teamIndex(teamId: string): number {
  const match = /team-(\d+)/.exec(teamId);
  const n = match?.[1] ? Number(match[1]) : 0;
  return n % PALETTES.length;
}

export function teamPalette(teamId: string): TeamPalette {
  return PALETTES[teamIndex(teamId)]!;
}
