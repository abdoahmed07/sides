import { useEffect, useState } from 'react';

/**
 * Whether this browser uses the app without an account. The choice is
 * remembered per browser; the habits themselves are stored by the device backend.
 */
const MODE_KEY = 'streak.mode';
const EVENT = 'streak-mode-change';

/** Fallback for when storage is blocked, so the choice still lasts this visit. */
let memory: boolean | null = null;

function read(): boolean {
  if (memory !== null) return memory;
  try {
    return localStorage.getItem(MODE_KEY) === 'device';
  } catch {
    return false;
  }
}

export function setDeviceMode(on: boolean) {
  memory = on;
  try {
    if (on) localStorage.setItem(MODE_KEY, 'device');
    else localStorage.removeItem(MODE_KEY);
  } catch {
    // storage blocked: the choice lasts for this visit only
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useDeviceMode(): boolean {
  const [on, setOn] = useState(read);
  useEffect(() => {
    const sync = () => setOn(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return on;
}
