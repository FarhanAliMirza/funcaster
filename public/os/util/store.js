const shallowEqual = (a, b) =>
  Object.is(a, b) ||
  (a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((k) => Object.is(a[k], b[k])));
export function createStore(initial = {}) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      state = {
        ...state,
        ...(typeof patch === "function" ? patch(state) : patch),
      };
      for (const listener of [...listeners]) listener(state);
    },
    subscribe(selector, fn) {
      let value = selector(state);
      const listener = (next) => {
        const selected = selector(next);
        if (!shallowEqual(value, selected)) {
          const previous = value;
          value = selected;
          fn(selected, previous);
        }
      };
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
