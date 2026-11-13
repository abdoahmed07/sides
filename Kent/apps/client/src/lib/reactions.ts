/**
 * Table talk: meme stickers you can "say" and things you can throw at other players.
 * Purely for fun: none of this touches the game rules. No hand gestures here on purpose,
 * so a reaction can never be mistaken for a team signal.
 */

export const STICKERS = [
  { id: "dead", emoji: "💀", caption: "I'm dead" },
  { id: "sus", emoji: "🤨", caption: "sus" },
  { id: "cooking", emoji: "🔥", caption: "cooking" },
  { id: "hurry", emoji: "🥱", caption: "hurry up" },
  { id: "why", emoji: "😭", caption: "why me" },
  { id: "clown", emoji: "🤡", caption: "clown" },
  { id: "brain", emoji: "🧠", caption: "big brain" },
  { id: "over", emoji: "🫠", caption: "it's over" },
  { id: "watching", emoji: "👀", caption: "I see you" },
  { id: "rematch", emoji: "😤", caption: "rematch" },
] as const;
export type StickerId = (typeof STICKERS)[number]["id"];

export const THROWABLES = [
  { id: "tomato", emoji: "🍅", label: "Tomato", word: "SPLAT!", burst: ["#e3342f", "#ff6b5e", "#b91c1c"], color: "#e3342f" },
  { id: "egg", emoji: "🥚", label: "Egg", word: "CRACK!", burst: ["#fde68a", "#fbbf24", "#fff7e0"], color: "#fbbf24" },
  { id: "slipper", emoji: "🩴", label: "Slipper", word: "BONK!", burst: ["⭐", "💫", "⭐"], color: "#60a5fa" },
  { id: "rose", emoji: "🌹", label: "Rose", word: "aww", burst: ["💕", "🌸", "💖"], color: "#f472b6" },
  { id: "money", emoji: "💸", label: "Money", word: "KA-CHING", burst: ["💵", "🪙", "💵"], color: "#4ade80" },
  { id: "ice", emoji: "🧊", label: "Ice", word: "CHILL", burst: ["❄️", "💠", "❄️"], color: "#7dd3fc" },
] as const;
export type ThrowId = (typeof THROWABLES)[number]["id"];

export const STICKER_BY_ID = Object.fromEntries(STICKERS.map((s) => [s.id, s])) as Record<StickerId, (typeof STICKERS)[number]>;
export const THROW_BY_ID = Object.fromEntries(THROWABLES.map((t) => [t.id, t])) as Record<ThrowId, (typeof THROWABLES)[number]>;

export type ReactionInput = { kind: "say"; item: StickerId } | { kind: "throw"; item: ThrowId; to: string };
export type Reaction = ReactionInput & { id: number; from: string; atMs: number };

/** How long after a throw the item lands. */
export const FLIGHT_MS = 620;
