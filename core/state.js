// A data-only snapshot: callbacks and prototype methods never cross the network.
export function encodeState(value, depth = 0) {
  if (depth > 18 || typeof value === "function" || value === undefined)
    return undefined;
  if (typeof value === "number" && !Number.isFinite(value))
    return { $number: String(value) };
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Map)
    return { $map: [...value].map(([k, v]) => [k, encodeState(v, depth + 1)]) };
  if (value instanceof Set) return { $set: [...value] };
  if (Array.isArray(value)) return value.map((v) => encodeState(v, depth + 1));
  const out = {};
  for (const k of Object.keys(value)) {
    if (
      [
        "__proto__",
        "prototype",
        "constructor",
        "onEvent",
        "rng",
        "spawnRng",
      ].includes(k)
    )
      continue;
    const v = encodeState(value[k], depth + 1);
    if (v !== undefined) out[k] = v;
  }
  return out;
}
export function restoreState(target, value, depth = 0) {
  if (depth > 18) return target;
  if (value === null || typeof value !== "object") return value;
  if (value.$number) return Number(value.$number);
  if (value.$map) {
    const m = target instanceof Map ? target : new Map();
    const keys = new Set(value.$map.map(([k]) => k));
    for (const k of m.keys()) if (!keys.has(k)) m.delete(k);
    for (const [k, v] of value.$map)
      m.set(k, restoreState(m.get(k), v, depth + 1));
    return m;
  }
  if (value.$set) return new Set(value.$set);
  if (Array.isArray(value)) {
    const a = Array.isArray(target) ? target : [];
    a.length = value.length;
    value.forEach((v, i) => (a[i] = restoreState(a[i], v, depth + 1)));
    return a;
  }
  const out = target && typeof target === "object" ? target : {};
  for (const [k, v] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(k)) continue;
    out[k] = restoreState(out[k], v, depth + 1);
  }
  return out;
}
