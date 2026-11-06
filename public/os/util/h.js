export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on") && typeof value === "function")
      el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el && !key.startsWith("aria-")) el[key] = value;
    else el.setAttribute(key, String(value));
  }
  el.append(...children.flat(Infinity).filter((x) => x != null && x !== false));
  return el;
}
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
