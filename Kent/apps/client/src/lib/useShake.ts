import { animate } from "framer-motion";
import { useEffect, useRef } from "react";

/** Gives the element a quick "ouch" wobble every time `trigger` changes to a new truthy value. */
export function useShake<T extends HTMLElement>(trigger: number | undefined, strength = 9) {
  const ref = useRef<T>(null);
  const last = useRef(trigger);
  useEffect(() => {
    if (!trigger || trigger === last.current || !ref.current) return;
    last.current = trigger;
    const s = strength;
    animate(ref.current, { x: [0, -s, s * 0.9, -s * 0.6, s * 0.3, 0], rotate: [0, -s, s * 0.8, -s * 0.5, s * 0.2, 0] }, { duration: 0.5 });
  }, [trigger, strength]);
  return ref;
}
