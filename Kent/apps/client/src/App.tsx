import { MotionConfig, motion } from "framer-motion";
import { CallBanner } from "./components/CallBanner";
import { ErrorToast } from "./components/ErrorToast";
import { ReactionLayer } from "./components/ReactionLayer";
import { SoundToggle } from "./components/SoundToggle";
import { BetweenHandsScreen } from "./screens/BetweenHandsScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { MatchOverScreen } from "./screens/MatchOverScreen";
import { TableScreen } from "./screens/TableScreen";
import { useGameStore } from "./store/gameStore";

function Screen({ phase }: { phase: string | undefined }) {
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
  const phase = useGameStore((s) => s.gameState?.phase);
  const screen = phase === "between_hands" || phase === "playing" || phase === "match_over" ? phase : "home";

  return (
    <MotionConfig reducedMotion="user">
      <div className="felt-texture flex min-h-svh flex-col overflow-x-hidden">
        <SoundToggle />
        {/* Entrance-only: an exit animation would have to wait on every card's layout animation. */}
        <motion.main
          key={screen}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 0.9, 0.3, 1] }}
          className="flex flex-1 flex-col"
        >
          <Screen phase={phase} />
        </motion.main>
        <ReactionLayer />
        <CallBanner />
        <ErrorToast />
      </div>
    </MotionConfig>
  );
}
