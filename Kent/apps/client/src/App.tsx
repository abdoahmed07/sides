import { BetweenHandsScreen } from "./screens/BetweenHandsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MatchOverScreen } from "./screens/MatchOverScreen";
import { TableScreen } from "./screens/TableScreen";
import { useGameStore } from "./store/gameStore";

function Screen() {
  const phase = useGameStore((s) => s.gameState?.phase);

  switch (phase) {
    case "between_hands":
      return <BetweenHandsScreen />;
    case "playing":
      return <TableScreen />;
    case "match_over":
      return <MatchOverScreen />;
    default:
      return <HomeScreen />;
  }
}

export default function App() {
  return (
    <div className="felt-texture flex min-h-svh flex-col">
      <Screen />
    </div>
  );
}
