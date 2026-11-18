/**
 * Deciding what a sync should do. Pure, so it can be tested.
 *
 * The account holds one snapshot of everything, with a revision number that
 * goes up by one on every upload. Each device remembers the revision it last
 * synced and whether it has changed anything since.
 */
export type SyncAction = "none" | "upload" | "download" | "conflict";

export type SyncInput = {
  /** This device has a plan or any progress. */
  localHasData: boolean;
  /** This device changed something since its last sync. */
  localDirty: boolean;
  /** Revision this device last synced with this account; null if never. */
  lastRev: number | null;
  /** The account's snapshot revision; null if the account has no data yet. */
  remoteRev: number | null;
};

export function decideSync({ localHasData, localDirty, lastRev, remoteRev }: SyncInput): SyncAction {
  if (remoteRev === null) return localHasData ? "upload" : "none";
  // Nothing here: a new device downloads; a device that just deleted everything on purpose uploads that.
  if (!localHasData) return localDirty && lastRev !== null ? "upload" : "download";
  // First sync on a device that already has its own progress: ask which to keep.
  if (lastRev === null) return "conflict";
  if (remoteRev > lastRev) return localDirty ? "conflict" : "download";
  return localDirty ? "upload" : "none";
}
