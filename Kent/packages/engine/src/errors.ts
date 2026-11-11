export type EngineErrorCode =
  | "INVALID_PLAYER_COUNT"
  | "SEAT_TAKEN"
  | "SEAT_NOT_FOUND"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "NOT_ALL_READY"
  | "WRONG_PHASE"
  | "ALREADY_DONE"
  | "INVALID_CENTER_SLOT"
  | "CARD_NOT_IN_HAND"
  | "UNKNOWN_PLAYER"
  | "SIGNAL_LOCKED_DURING_HAND"
  | "PLAYER_NOT_SEATED"
  | "ROOM_FULL";

export class EngineError extends Error {
  code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}
