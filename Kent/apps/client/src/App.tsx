import { BetweenHandsScreen } from "./screens/BetweenHandsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { MatchOverScreen } from "./screens/MatchOverScreen";
import { TableScreen } from "./screens/TableScreen";
import { useGameStore } from "./store/gameStore";

function Screen() {
  const { session, gameState } = useGameStore();

  if (!session || !gameState) {
    return <HomeScreen />;
  }

  switch (gameState.phase) {
    case "lobby":
      return <LobbyScreen />;
    case "between_hands":
      return <BetweenHandsScreen />;
    case "playing":
      return <TableScreen />;
    case "match_over":
      return <MatchOverScreen />;
    default:
      return null;
  }
}

function ConnectionBanner() {
  const status = useGameStore((s) => s.status);
  if (status === "connected") return null;
  return (
    <div className="bg-danger/90 py-1 text-center text-xs font-semibold text-felt-950">
      {status === "connecting" ? "Connecting to server…" : "Connection lost — trying to reconnect…"}
    </div>
  );
}

export default function App() {
  return (
    <div className="felt-texture flex min-h-svh flex-col">
      <ConnectionBanner />
      <Screen />
    </div>
  );
}
