let counter = 0;

/** Dependency-free unique id generator (works identically in Node and browser bundles). */
export function generateId(prefix = "id"): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${rand}`;
}
