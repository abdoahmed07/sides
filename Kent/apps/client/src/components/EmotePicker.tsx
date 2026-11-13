import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { STICKERS, THROWABLES, type StickerId, type ThrowId } from "../lib/reactions";

export interface EmotePickerProps {
  open: boolean;
  onClose: () => void;
  onSay: (id: StickerId) => void;
  onAim: (id: ThrowId) => void;
}

/** Bottom sheet with two tabs: stickers to say, and things to throw at someone. */
export function EmotePicker({ open, onClose, onSay, onAim }: EmotePickerProps) {
  const [tab, setTab] = useState<"say" | "throw">("say");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-label="Reactions"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-3xl border border-white/10 bg-felt-800 px-4 pt-3 pb-6"
            style={{ boxShadow: "0 -20px 50px -10px rgba(0,0,0,0.8)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 80 && onClose()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/15" />
            <div className="mb-4 flex rounded-xl bg-felt-950/60 p-1">
              {(["say", "throw"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`relative flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === t ? "text-felt-950" : "text-cream-300"}`}
                >
                  {tab === t && (
                    <motion.span layoutId="emote-tab" className="absolute inset-0 rounded-lg bg-gold-400" transition={{ type: "spring", stiffness: 500, damping: 36 }} />
                  )}
                  <span className="relative">{t === "say" ? "Say something" : "Throw something"}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {tab === "say" ? (
                <motion.div
                  key="say"
                  className="grid grid-cols-5 gap-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                >
                  {STICKERS.map((s, i) => (
                    <motion.button
                      key={s.id}
                      type="button"
                      onClick={() => onSay(s.id)}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.025, type: "spring", stiffness: 500, damping: 22 }}
                      whileHover={{ y: -3, rotate: -4 }}
                      whileTap={{ scale: 0.85 }}
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl bg-felt-700/70 hover:bg-felt-600"
                    >
                      <span className="text-3xl leading-none">{s.emoji}</span>
                      <span className="text-[10px] leading-none font-semibold text-cream-300">{s.caption}</span>
                    </motion.button>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="throw"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {THROWABLES.map((t, i) => (
                      <motion.button
                        key={t.id}
                        type="button"
                        onClick={() => onAim(t.id)}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03, type: "spring", stiffness: 500, damping: 22 }}
                        whileHover={{ y: -3, rotate: 8 }}
                        whileTap={{ scale: 0.85, rotate: -20 }}
                        className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-felt-700/70 py-3 hover:bg-felt-600"
                      >
                        <span className="text-4xl leading-none">{t.emoji}</span>
                        <span className="text-xs font-semibold text-cream-300">{t.label}</span>
                      </motion.button>
                    ))}
                  </div>
                  <p className="mt-3 text-center text-xs text-cream-100/45">Pick one, then tap who to throw it at. Careful: bots throw back.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
