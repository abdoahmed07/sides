import type { RedactedGameState } from "@kent/engine";

export function teamMemberNames(gameState: RedactedGameState, teamId: string): string {
  const team = gameState.partnerships[teamId];
  if (!team) return "";
  return team.seats
    .map((seat) => gameState.seats[seat])
    .filter((id): id is string => !!id)
    .map((id) => gameState.players[id]?.name ?? "?")
    .join(" & ");
}
