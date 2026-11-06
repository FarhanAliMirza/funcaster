/** Spatial navigation uses CSS-pixel rectangles, independently of theme scale. */
export const DIRECTIONS = ["left", "right", "up", "down"];
const centre = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
export function navigationScore(from, to, direction) {
  const a = centre(from),
    b = centre(to),
    horizontal = ["left", "right"].includes(direction);
  const sign = ["left", "up"].includes(direction) ? -1 : 1;
  if ((horizontal ? b.x - a.x : b.y - a.y) * sign <= 0.5) return Infinity;
  const primary = Math.max(
    0,
    horizontal
      ? sign > 0
        ? to.left - from.right
        : from.left - to.right
      : sign > 0
        ? to.top - from.bottom
        : from.top - to.bottom,
  );
  const secondary = Math.abs(horizontal ? b.y - a.y : b.x - a.x);
  const overlap = Math.max(
    0,
    horizontal
      ? Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top)
      : Math.min(from.right, to.right) - Math.max(from.left, to.left),
  );
  const span = Math.min(
    horizontal ? from.height : from.width,
    horizontal ? to.height : to.width,
  );
  return primary + 2 * secondary - 80 * (span > 0 ? overlap / span : 0);
}
export function spatialNext(
  items,
  current,
  direction,
  { group = null, axis = "horizontal", wrap = false, grid = false } = {},
) {
  if (!items.length) return null;
  const from = items.find((item) => item.id === current);
  if (!from) return items.find((item) => item.default)?.id ?? items[0].id;
  const along =
    axis === "horizontal"
      ? ["left", "right"].includes(direction)
      : ["up", "down"].includes(direction);
  if (group && along) {
    const members = items.filter((item) => item.group === group);
    const at = members.findIndex((item) => item.id === current),
      delta = ["left", "up"].includes(direction) ? -1 : 1;
    if (members[at + delta]) return members[at + delta].id;
    if (wrap && members.length > 1)
      return members[(at + delta + members.length) % members.length].id;
  }
  let candidates = items.filter((item) => item !== from);
  if (grid) {
    const a = centre(from.rect),
      horizontal = ["left", "right"].includes(direction);
    candidates = candidates.filter(
      (item) =>
        Math.abs(
          horizontal ? centre(item.rect).y - a.y : centre(item.rect).x - a.x,
        ) < 2,
    );
  }
  const ranked = candidates
    .map((item) => ({
      item,
      score: navigationScore(from.rect, item.rect, direction),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score);
  if (ranked.length) return ranked[0].item.id;
  if (grid && wrap && candidates.length) {
    const horizontal = ["left", "right"].includes(direction),
      sign = ["left", "up"].includes(direction) ? -1 : 1;
    candidates.sort(
      (a, b) =>
        sign *
        (horizontal ? a.rect.left - b.rect.left : a.rect.top - b.rect.top),
    );
    return candidates[0].id;
  }
  return null;
}
export function visibleTargets(scope) {
  if (!scope) return [];
  return [...scope.querySelectorAll("[data-nav]")].filter((element) => {
    if (element.disabled || element.closest("[hidden],[inert],[data-nav-skip]"))
      return false;
    const style = getComputedStyle(element),
      rect = element.getBoundingClientRect();
    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      rect.width > 0 &&
      rect.height > 0
    );
  });
}
export function restoreTarget(opener, remembered, targets) {
  return targets.includes(opener)
    ? opener
    : targets.includes(remembered)
      ? remembered
      : targets.find((e) => e.hasAttribute("data-nav-default")) ||
        targets[0] ||
        null;
}
export function createNavigation({
  root,
  getScope,
  desktop,
  taskbar,
  onBack,
  onHome,
  onVolume,
  onHelp,
  isGame = () => false,
  cue = () => {},
  onMode = () => {},
}) {
  const memory = new WeakMap();
  let lastIcon = null,
    gamepadPrevious = new Set(),
    mode = "focus";
  function setMode(next) {
    if (next === mode) return;
    mode = next;
    root.dataset.inputMode = next;
    onMode(next);
  }
  root.dataset.inputMode = mode;
  function scope() {
    return getScope?.() || root;
  }
  function focus(element) {
    if (!element) return false;
    element.focus();
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
    memory.set(scope(), element);
    if (desktop?.contains(element)) lastIcon = element;
    return true;
  }
  function move(direction) {
    setMode("focus");
    const container = scope(),
      targets = visibleTargets(container),
      current = document.activeElement;
    if (!targets.includes(current))
      return focus(restoreTarget(null, memory.get(container), targets));
    if (
      container === root &&
      direction === "up" &&
      taskbar?.contains(current) &&
      lastIcon?.isConnected
    )
      return focus(lastIcon);
    const group = current.closest("[data-nav-group]"),
      grid = current.closest("[data-nav-grid]");
    const gridTargets = grid
      ? targets.filter((e) => grid.contains(e))
      : targets;
    const items = gridTargets.map((e) => ({
      id: e,
      rect: e.getBoundingClientRect(),
      group: e.closest("[data-nav-group]"),
      default: e.hasAttribute("data-nav-default"),
    }));
    // Down from the last desktop row reaches Start before vertical wrapping.
    if (
      grid &&
      direction === "down" &&
      !spatialNext(items, current, direction, { grid: true }) &&
      container === root
    )
      return focus(taskbar?.querySelector("[data-id=start]"));
    const next = spatialNext(items, current, direction, {
      group,
      axis: group?.dataset.navAxis || "horizontal",
      wrap:
        !!grid ||
        group?.getAttribute("role") === "tablist" ||
        group?.dataset.navWrap === "true",
      grid: !!grid,
    });
    if (next) return focus(next);
    cue("edge");
    return false;
  }
  function adjust(delta) {
    const target = document.activeElement;
    if (
      target?.matches('input[type="range"], input[type="number"]') &&
      !target.disabled
    ) {
      delta > 0 ? target.stepUp() : target.stepDown();
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    } else onVolume?.(delta * 5);
  }
  function activate(target = document.activeElement) {
    if (!visibleTargets(scope()).includes(target)) return false;
    target.click();
    cue("click");
    return true;
  }
  function route(button) {
    if (DIRECTIONS.includes(button)) return move(button);
    if (button === "A") return activate();
    if (button === "B") return onBack?.();
    if (button === "home") return onHome?.();
    if (button === "plus" || button === "minus")
      return adjust(button === "plus" ? 1 : -1);
    if (button === "2") return onHelp?.(document.activeElement?.dataset.help);
  }
  const keys = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    Enter: "A",
    " ": "A",
    Escape: "B",
    F10: "home",
    "+": "plus",
    "=": "plus",
    "-": "minus",
  };
  function key(event) {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.repeat
    )
      return;
    if (
      (event.key === "ContextMenu" ||
        (event.key === "F10" && event.shiftKey)) &&
      !isGame()
    ) {
      const target = document.activeElement;
      if (target?.hasAttribute("data-nav")) {
        const r = target.getBoundingClientRect();
        event.preventDefault();
        target.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
          }),
        );
      }
      return;
    }
    const input = event.target.closest?.(
      "input,textarea,select,[contenteditable=true]",
    );
    if (input && event.key !== "Escape" && event.key !== "F10") return;
    const button = keys[event.key];
    if (!button || (isGame() && button !== "B" && button !== "home")) return;
    event.preventDefault();
    route(button);
  }
  function remember(event) {
    if (event.target.matches?.("[data-nav]")) {
      memory.set(scope(), event.target);
      if (desktop?.contains(event.target)) lastIcon = event.target;
    }
  }
  document.addEventListener("keydown", key);
  document.addEventListener("focusin", remember);
  const timer = setInterval(() => {
    if (isGame()) {
      gamepadPrevious.clear();
      return;
    }
    const active = new Set();
    for (const pad of navigator.getGamepads?.() || []) {
      if (!pad) continue;
      const pressed = (i) => pad.buttons[i]?.pressed;
      for (const [i, button] of [
        [0, "A"],
        [1, "B"],
        [9, "home"],
        [12, "up"],
        [13, "down"],
        [14, "left"],
        [15, "right"],
      ])
        if (pressed(i)) active.add(button);
      if (pad.axes[0] < -0.5) active.add("left");
      if (pad.axes[0] > 0.5) active.add("right");
      if (pad.axes[1] < -0.5) active.add("up");
      if (pad.axes[1] > 0.5) active.add("down");
      for (const [i, direction] of [
        [4, "left"],
        [5, "right"],
      ])
        if (pressed(i) && !gamepadPrevious.has(`tab-${i}`)) {
          const tabs = visibleTargets(scope()).filter(
            (e) => e.getAttribute("role") === "tab",
          );
          if (tabs.length) {
            const at = tabs.indexOf(document.activeElement);
            focus(
              tabs[
                (at + (direction === "left" ? -1 : 1) + tabs.length) %
                  tabs.length
              ],
            );
            document.activeElement.click();
          }
        }
      if (pressed(4)) active.add("tab-4");
      if (pressed(5)) active.add("tab-5");
    }
    for (const button of active)
      if (!gamepadPrevious.has(button)) route(button);
    gamepadPrevious = active;
  }, 120);
  return {
    move,
    activate,
    route,
    setMode,
    getMode: () => mode,
    scope,
    focus,
    restore(opener) {
      const s = scope();
      return focus(restoreTarget(opener, memory.get(s), visibleTargets(s)));
    },
    destroy() {
      clearInterval(timer);
      document.removeEventListener("keydown", key);
      document.removeEventListener("focusin", remember);
    },
  };
}
