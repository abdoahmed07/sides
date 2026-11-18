import { describe, expect, it } from "vitest";
import { decideSync, type SyncInput } from "../src/sync/decide";

const base: SyncInput = { localHasData: true, localDirty: false, lastRev: 3, remoteRev: 3 };
const d = (over: Partial<SyncInput>) => decideSync({ ...base, ...over });

describe("deciding what to sync", () => {
  it("first device: uploads its progress to an empty account", () => {
    expect(d({ remoteRev: null, lastRev: null, localDirty: true })).toBe("upload");
    expect(d({ remoteRev: null, lastRev: null, localHasData: false })).toBe("none");
  });

  it("new phone signing in: downloads the account's progress", () => {
    expect(d({ localHasData: false, lastRev: null, remoteRev: 5 })).toBe("download");
    // Even if the phone wrote something trivial, an empty device never overwrites the account the first time.
    expect(d({ localHasData: false, localDirty: true, lastRev: null, remoteRev: 5 })).toBe("download");
  });

  it("asks when a device with its own progress signs in to an account that has progress", () => {
    expect(d({ lastRev: null, remoteRev: 2 })).toBe("conflict");
  });

  it("uploads local changes when the account hasn't moved", () => {
    expect(d({ localDirty: true })).toBe("upload");
    expect(d({})).toBe("none");
  });

  it("downloads when another device uploaded and this one has no changes", () => {
    expect(d({ remoteRev: 4 })).toBe("download");
  });

  it("asks instead of overwriting when both changed", () => {
    expect(d({ remoteRev: 4, localDirty: true })).toBe("conflict");
  });

  it("deleting everything on a synced device clears the account too", () => {
    expect(d({ localHasData: false, localDirty: true })).toBe("upload");
  });
});
