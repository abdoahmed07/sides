import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useGameStore } from "../store/gameStore";

export function ErrorToast() {
  const error = useGameStore((s) => s.lastError);
  const clear = useGameStore((s) => s.clearError);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(clear, 2600);
    return () => window.clearTimeout(t);
  }, [error, clear]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <AnimatePresence>
        {error && (
          <motion.div
            key={error.message}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            role="alert"
            className="rounded-xl border border-danger/40 bg-felt-900/95 px-4 py-2.5 text-sm text-cream-100 shadow-pop backdrop-blur"
          >
            {error.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
