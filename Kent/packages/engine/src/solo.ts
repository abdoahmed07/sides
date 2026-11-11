import { addPlayer, applyAction, createGameState } from "./reducer.js";
import type { GameState, PlayerCount } from "./types.js";

const BOT_NAMES = ["Ava", "Milo", "Zara", "Theo", "Luna", "Omar", "Ivy"];

export const HUMAN_ID = "you";

export function botId(index: number): string {
  return `bot-${index}`;
}

export function isBotId(playerId: string): boolean {
  return playerId.startsWith("bot-");
}

/**
 * One human against bots, all in one browser. The human takes seat 0, so
 * their partner is the bot directly across the table. Returns a match
 * already started and waiting in between_hands for signals + ready-up.
 */
export function createSoloMatch(humanName: string, seatCount: PlayerCount, now: number = Date.now()): GameState {
  let state = createGameState({ roomCode: "SOLO", hostPlayerId: HUMAN_ID, hostName: humanName, seatCount, now });
  for (let i = 1; i < seatCount; i++) {
    state = addPlayer(state, botId(i), BOT_NAMES[(i - 1) % BOT_NAMES.length]!);
  }
  for (let seat = 0; seat < seatCount; seat++) {
    const playerId = seat === 0 ? HUMAN_ID : botId(seat);
    state = applyAction(state, { type: "JOIN_SEAT", playerId, seat }, now);
    state = applyAction(state, { type: "SET_READY", playerId, ready: true }, now);
  }
  return applyAction(state, { type: "START_MATCH", playerId: HUMAN_ID }, now);
}
