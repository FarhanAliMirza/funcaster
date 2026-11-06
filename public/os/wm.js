import { h, clamp } from "./util/h.js";
import { BRAND } from "./brand.js";
import { WINDOW_STRINGS as S } from "./strings.js";
import { open as openMessageBox } from "./windows/message-box.js";

const normalWork = (work = {}) => ({
  x: Number(work.x) || 0,
  y: Number(work.y) || 0,
  w: Math.max(1, Number(work.w) || 1),
  h: Math.max(1, Number(work.h) || 1),
  ui: Math.max(0.1, Number(work.ui) || 1),
});
export function clampRect(rect, area) {
  const work = normalWork(area),
    w = Math.min(Math.max(1, rect.w), work.w),
    h = Math.min(Math.max(1, rect.h), work.h);
  return {
    x: clamp(rect.x, work.x, work.x + work.w - w),
    y: clamp(rect.y, work.y, work.y + work.h - h),
    w,
    h,
  };
}
export function placeWindow(size, area, offset = 0) {
  const work = normalWork(area),
    w = Math.min((size?.w || 640) * work.ui, work.w * 0.92),
    h = Math.min((size?.h || 440) * work.ui, work.h * 0.92);
  return clampRect(
    {
      x: work.x + (work.w - w) / 2 + offset * 28 * work.ui,
      y: work.y + (work.h - h) / 2 + offset * 28 * work.ui,
      w,
      h,
    },
    work,
  );
}
const visible = (el) =>
  !!el &&
  !el.closest("[hidden],[inert],[aria-hidden='true']") &&
  el.getClientRects().length > 0 &&
  el.ownerDocument?.defaultView?.getComputedStyle(el).visibility !== "hidden";
export function visibleFocusable(root) {
  return [
    ...root.querySelectorAll(
      "[data-nav]:not([disabled]),button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex='0']",
    ),
  ].filter(visible);
}
const coexists = (a, b) =>
  [a, b].includes("game-properties") &&
  [a, b].some((id) => ["players", "invite"].includes(id));
export function replacementIds(windows, incoming, keep = false) {
  if (keep || incoming.kind === "game" || incoming.kind === "modal") return [];
  return windows
    .filter(
      (entry) =>
        entry.kind === "tool" &&
        !entry.pinned &&
        entry.id !== incoming.id &&
        !coexists(entry.manifestId || entry.id, incoming.id),
    )
    .map((entry) => entry.id);
}

/** Geometry and stacking are DOM-independent so the layout rules are tested. */
export class WindowModel {
  constructor({
    getWorkArea = () => ({ x: 0, y: 0, w: 1280, h: 678, ui: 1 }),
    getViewport = getWorkArea,
  } = {}) {
    this.getWorkArea = getWorkArea;
    this.getViewport = getViewport;
    this.entries = new Map();
    this.focusId = null;
    this.z = 100;
  }
  list() {
    return [...this.entries.values()].sort((a, b) => a.z - b.z);
  }
  top() {
    return (
      this.list()
        .filter((entry) => entry.state !== "minimised")
        .at(-1) || null
    );
  }
  add(config) {
    const old = this.entries.get(config.id);
    if (old) {
      if (old.state === "minimised") this.restore(old.id);
      else this.focus(old.id);
      return old;
    }
    const kind = config.kind || "tool";
    const area = normalWork(
      kind === "game" ? this.getViewport() : this.getWorkArea(),
    );
    const rect =
      kind === "game"
        ? clampRect(this.getViewport(), this.getViewport())
        : placeWindow(
            config.size,
            this.getWorkArea(),
            this.list().filter(
              (entry) => entry.kind === "tool" && entry.state !== "minimised",
            ).length,
          );
    const entry = {
      ...config,
      kind,
      rect,
      normalRect: { ...rect },
      normalAnchor: {
        x: (rect.x + rect.w / 2 - area.x) / area.w,
        y: (rect.y + rect.h / 2 - area.y) / area.h,
      },
      state: kind === "game" ? "maximised" : "normal",
      pinned: !!config.pinned,
      z: kind === "modal" ? 910 : 100,
    };
    this.entries.set(entry.id, entry);
    this.focus(entry.id);
    return entry;
  }
  focus(id) {
    const entry = this.entries.get(id);
    if (!entry || entry.state === "minimised") return false;
    const modal = this.list().find((candidate) => candidate.kind === "modal");
    if (modal && modal.id !== id) return false;
    if (entry.kind !== "modal") {
      if (++this.z >= 899) {
        this.z = 100;
        for (const candidate of this.list().filter((e) => e.kind !== "modal"))
          candidate.z = ++this.z;
      }
      entry.z = ++this.z;
    }
    this.focusId = id;
    return true;
  }
  setTitle(id, title, icon) {
    const entry = this.entries.get(id);
    if (!entry) return false;
    entry.title = String(title);
    if (icon !== undefined) entry.icon = icon;
    return true;
  }
  close(id) {
    const entry = this.entries.get(id);
    if (!entry) return null;
    this.entries.delete(id);
    if (this.focusId === id) {
      this.focusId = null;
      const next = this.top();
      if (next) this.focus(next.id);
    }
    return entry;
  }
  minimise(id) {
    const entry = this.entries.get(id);
    if (
      !entry ||
      entry.kind !== "tool" ||
      entry.state === "minimised" ||
      entry.canMinimise === false
    )
      return false;
    entry.beforeMinimise = entry.state;
    entry.state = "minimised";
    if (this.focusId === id) {
      this.focusId = null;
      const next = this.top();
      if (next) this.focus(next.id);
    }
    return true;
  }
  maximise(id) {
    const entry = this.entries.get(id);
    if (!entry || entry.kind === "modal" || entry.canMaximise === false)
      return false;
    if (entry.state === "normal") entry.normalRect = { ...entry.rect };
    const work =
      entry.kind === "game" ? this.getViewport() : this.getWorkArea();
    entry.rect = clampRect(work, work);
    entry.state = "maximised";
    this.focus(id);
    return true;
  }
  restore(id) {
    const entry = this.entries.get(id);
    if (!entry) return false;
    if (entry.state === "minimised") {
      entry.state = entry.beforeMinimise || "normal";
      if (entry.state === "maximised") return this.maximise(id);
    } else if (entry.state === "maximised" && entry.kind !== "game") {
      entry.state = "normal";
      entry.rect = clampRect(entry.normalRect, this.getWorkArea());
    }
    this.focus(id);
    return true;
  }
  move(id, point) {
    const entry = this.entries.get(id);
    if (!entry || entry.kind !== "tool" || entry.state !== "normal")
      return false;
    const area = normalWork(this.getWorkArea());
    entry.rect = clampRect({ ...entry.rect, x: point.x, y: point.y }, area);
    entry.normalRect = { ...entry.rect };
    entry.normalAnchor = {
      x: (entry.rect.x + entry.rect.w / 2 - area.x) / area.w,
      y: (entry.rect.y + entry.rect.h / 2 - area.y) / area.h,
    };
    return true;
  }
  relayout() {
    for (const entry of this.entries.values()) {
      const work = normalWork(
        entry.kind === "game" ? this.getViewport() : this.getWorkArea(),
      );
      // Keep the intended size and drag anchor, never a previously clipped
      // rectangle. Hidden tabs can initially report a zero-sized work area.
      const desired = placeWindow(entry.size, work);
      entry.normalRect =
        entry.kind === "game"
          ? clampRect(work, work)
          : clampRect(
              {
                ...desired,
                x: work.x + entry.normalAnchor.x * work.w - desired.w / 2,
                y: work.y + entry.normalAnchor.y * work.h - desired.h / 2,
              },
              work,
            );
      entry.rect =
        entry.state === "maximised" ||
        (entry.beforeMinimise === "maximised" && entry.state === "minimised")
          ? clampRect(work, work)
          : { ...entry.normalRect };
    }
  }
}

export class ModalQueue {
  constructor() {
    this.items = [];
  }
  get active() {
    return this.items[0] || null;
  }
  push(options) {
    return new Promise((resolve) => {
      this.items.push({ options, resolve });
    });
  }
  choose(id) {
    const current = this.items.shift();
    current?.resolve(id);
    return this.active;
  }
  clear() {
    while (this.active) this.choose(this.active.options.cancelButton || null);
  }
}

export function createWindowManager({
  root,
  manifest = [],
  context = {},
  getWorkArea,
  getViewport,
  onChange = () => {},
  onScope = () => {},
  cue = () => {},
} = {}) {
  if (!root) throw new TypeError("A desktop root is required");
  const model = new WindowModel({ getWorkArea, getViewport }),
    definitions = new Map(),
    handles = new Map(),
    modals = new ModalQueue();
  const layer = h("div", { class: "os-windows" }),
    scrim = h("div", { class: "os-modal-scrim", hidden: true });
  root.append(layer, scrim);
  let openTail = Promise.resolve(),
    counter = 0,
    modalHandle = null,
    modalOpener = null,
    destroyed = false;
  const registry = Array.isArray(manifest)
    ? manifest
    : Object.entries(manifest).map(([id, entry]) => ({ id, ...entry }));
  registry.forEach((entry) => definitions.set(entry.id, entry));
  const outsideInert = new Map();
  const scopedFocus = (handle) => {
    if (!handle || handle.model.state === "minimised") return;
    const active = root.ownerDocument.activeElement;
    if (!handle.el.contains(active) || !visible(active))
      (
        visibleFocusable(handle.body)[0] ||
        visibleFocusable(handle.el)[0] ||
        handle.el
      ).focus();
  };
  function sync() {
    const focused = model.entries.get(model.focusId);
    if (modalHandle) {
      for (const child of root.children)
        if (child !== layer && child !== scrim) {
          if (!outsideInert.has(child)) outsideInert.set(child, child.inert);
          child.inert = true;
        }
    } else {
      for (const [child, wasInert] of outsideInert) child.inert = wasInert;
      outsideInert.clear();
    }
    for (const handle of handles.values()) {
      const entry = handle.model,
        rect = entry.rect;
      Object.assign(handle.el.style, {
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
        zIndex: String(entry.z),
      });
      handle.el.hidden = entry.state === "minimised";
      handle.el.dataset.state = entry.state;
      handle.el.classList.toggle(
        "os-window-active",
        entry.id === model.focusId,
      );
      handle.el.inert = !!modalHandle && handle !== modalHandle;
      if (handle.maxButton) {
        const max = entry.state === "maximised";
        handle.maxButton.dataset.chrome = max ? "restore" : "max";
        handle.maxButton.setAttribute(
          "aria-label",
          max ? S.restore : S.maximise,
        );
      }
      if (handle.pinButton)
        handle.pinButton.setAttribute("aria-pressed", String(entry.pinned));
    }
    root.dataset.gameOpen = String(
      model.list().some((entry) => entry.kind === "game"),
    );
    onScope(focused ? handles.get(focused.id)?.el : null);
    onChange(api.list());
  }
  function chrome(entry, props = {}) {
    const el = h("section", {
      class: `xp-window os-window${entry.kind === "game" ? " os-game-window" : ""}`,
      tabIndex: -1,
      dataset: { window: entry.id },
      role: entry.kind === "modal" ? "dialog" : "region",
      "aria-label": entry.title || entry.id,
    });
    const body = h("div", { class: "os-window-body" });
    const handle = {
      id: entry.id,
      model: entry,
      el,
      body,
      props: { ...props },
      opener: root.ownerDocument.activeElement,
      content: null,
    };
    if (entry.kind !== "game") {
      const title = h("span", {
        class: "os-window-title",
        text: entry.title || entry.id,
      });
      const controls = h("div", { class: "os-window-controls" });
      const button = (text, label, callback) =>
        h("button", {
          type: "button",
          text,
          class: "os-window-control",
          "aria-label": label,
          dataset: {
            nav: "",
            chrome:
              label === S.minimise
                ? "min"
                : label === S.maximise
                  ? "max"
                  : label === S.close
                    ? "close"
                    : "pin",
          },
          onclick: (event) => {
            event.stopPropagation();
            callback();
          },
        });
      const bar = h(
        "header",
        { class: "xp-titlebar os-window-titlebar" },
        entry.icon ? h("img", { src: entry.icon, alt: "" }) : null,
        title,
        controls,
      );
      if (entry.kind === "tool") {
        handle.pinButton = button("⌖", S.pin, () => {
          entry.pinned = !entry.pinned;
          sync();
        });
        controls.append(handle.pinButton);
        if (entry.canMinimise !== false)
          controls.append(
            button("_", S.minimise, () => api.minimise(entry.id)),
          );
        if (entry.canMaximise !== false) {
          handle.maxButton = button("□", S.maximise, () =>
            entry.state === "maximised"
              ? api.restore(entry.id)
              : api.maximise(entry.id),
          );
          controls.append(handle.maxButton);
        }
      }
      if (entry.canClose !== false) {
        const close = button("×", S.close, () => {
          if (entry.kind === "modal")
            chooseModal(modals.active?.options.cancelButton || null);
          else void api.close(entry.id);
        });
        close.classList.add("os-window-close");
        controls.append(close);
      }
      el.append(bar);
      let drag = null;
      bar.addEventListener("pointerdown", (event) => {
        if (
          event.button !== 0 ||
          event.target.closest("button") ||
          entry.kind !== "tool" ||
          entry.state !== "normal"
        )
          return;
        api.focus(entry.id);
        drag = {
          pointer: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          rect: { ...entry.rect },
        };
        bar.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });
      bar.addEventListener("pointermove", (event) => {
        if (!drag || drag.pointer !== event.pointerId) return;
        model.move(entry.id, {
          x: drag.rect.x + event.clientX - drag.x,
          y: drag.rect.y + event.clientY - drag.y,
        });
        sync();
      });
      bar.addEventListener("pointerup", () => {
        drag = null;
      });
      bar.addEventListener("lostpointercapture", () => {
        drag = null;
      });
      bar.addEventListener("dblclick", (event) => {
        if (!event.target.closest("button") && entry.kind === "tool")
          entry.state === "maximised"
            ? api.restore(entry.id)
            : api.maximise(entry.id);
      });
    }
    el.append(body);
    el.addEventListener("pointerdown", () => {
      if (model.focusId !== entry.id) api.focus(entry.id);
    });
    layer.append(el);
    handles.set(entry.id, handle);
    return handle;
  }
  function remove(handle, restoreFocus = true) {
    const opener = handle.opener;
    handle.content?.destroy?.();
    handles.delete(handle.id);
    model.close(handle.id);
    handle.el.remove();
    sync();
    if (restoreFocus) {
      const top = handles.get(model.focusId);
      if (opener?.isConnected && !opener.closest("[hidden]")) {
        opener.focus();
        if (top && !top.el.contains(opener)) scopedFocus(top);
      } else if (top) scopedFocus(top);
      else onScope(null);
    }
  }
  function showModal() {
    if (modalHandle || !modals.active || destroyed) return;
    const props = modals.active.options;
    const entry = model.add({
      id: `message-box:${++counter}`,
      kind: "modal",
      title: props.title || BRAND.os,
      icon: props.icon,
      size: { w: 460, h: 270 },
      canClose: !!props.cancelButton,
    });
    modalHandle = chrome(entry, props);
    modalHandle.el.setAttribute("aria-modal", "true");
    modalHandle.content = openMessageBox(
      { ...context, wm: api, choose: chooseModal },
      props,
    );
    modalHandle.body.append(modalHandle.content.el);
    scrim.hidden = false;
    sync();
    modalHandle.content.focus();
    cue("notify");
  }
  function chooseModal(id) {
    const current = modals.active;
    if (!current) return;
    const ids = (current.options.buttons || [{ id: "ok" }]).map(
      (button) => button.id,
    );
    if (id !== null && !ids.includes(id)) return;
    const old = modalHandle;
    modalHandle = null;
    if (old) remove(old, false);
    modals.choose(id);
    scrim.hidden = !modals.active;
    showModal();
    sync();
    if (!modalHandle) {
      const top = handles.get(model.focusId);
      if (
        modalOpener?.isConnected &&
        !modalOpener.closest("[hidden]") &&
        (!top || top.el.contains(modalOpener))
      )
        modalOpener.focus();
      else if (top) scopedFocus(top);
      modalOpener = null;
    }
  }
  function keydown(event) {
    if (!modalHandle) return;
    if (event.key === "Escape" && modals.active.options.cancelButton) {
      event.preventDefault();
      event.stopPropagation();
      chooseModal(modals.active.options.cancelButton);
    }
    if (event.key === "Tab") {
      const focusable = visibleFocusable(modalHandle.el);
      const at = focusable.indexOf(root.ownerDocument.activeElement);
      if (
        focusable.length &&
        (at < 0 ||
          (event.shiftKey && at === 0) ||
          (!event.shiftKey && at === focusable.length - 1))
      ) {
        event.preventDefault();
        focusable[event.shiftKey ? focusable.length - 1 : 0].focus();
      }
    }
  }
  root.ownerDocument.addEventListener("keydown", keydown, true);
  const api = {
    register(id, definition) {
      const entry = typeof id === "object" ? id : { ...definition, id };
      definitions.set(entry.id, entry);
    },
    open(id, props = {}) {
      const run = async () => {
        if (destroyed) return null;
        const definition = definitions.get(id);
        if (!definition) throw new Error(`Unknown window: ${id}`);
        const old = definition.singleton !== false && handles.get(id);
        if (old) {
          Object.assign(old.props, props);
          await old.content?.updateProps?.(old.props);
          if (old.model.state === "minimised") api.restore(id);
          else api.focus(id);
          return old;
        }
        for (const oldId of replacementIds(
          model.list(),
          definition,
          props.keep || props.shiftKey,
        ))
          if (!(await api.close(oldId))) return null;
        const entry = model.add({
          ...definition,
          id: definition.singleton === false ? `${id}:${++counter}` : id,
          manifestId: id,
        });
        const handle = chrome(entry, props);
        try {
          handle.content = await (definition.open?.(
            { ...context, wm: api, window: handle, props: handle.props },
            handle.props,
          ) || { el: props.content || definition.content || h("div") });
          if (destroyed || !handles.has(handle.id)) {
            handle.content?.destroy?.();
            return null;
          }
          if (handle.content?.el) handle.body.append(handle.content.el);
          handle.update = (state) => handle.content?.update?.(state);
          sync();
          scopedFocus(handle);
          cue("open");
          return handle;
        } catch (error) {
          remove(handle);
          throw error;
        }
      };
      const result = openTail.then(run, run);
      openTail = result.catch(() => {});
      return result;
    },
    async close(id, { force = false } = {}) {
      const handle = handles.get(id);
      if (!handle) return true;
      if (handle.model.kind === "modal") {
        if (force || modals.active?.options.cancelButton)
          chooseModal(modals.active?.options.cancelButton || null);
        return true;
      }
      if (!force && handle.model.canClose === false) return false;
      if (handle.closing) return handle.closing;
      handle.closing = (async () => {
        const before = handle.content?.onClose || handle.model.onClose;
        if (!force && before && (await before(handle)) === false) return false;
        if (handles.has(id)) {
          remove(handle);
          cue("close");
        }
        return true;
      })();
      try {
        return await handle.closing;
      } finally {
        handle.closing = null;
      }
    },
    setTitle(id, title, icon) {
      if (!model.setTitle(id, title, icon)) return false;
      const handle = handles.get(id);
      handle.el.setAttribute("aria-label", String(title));
      const label = handle.el.querySelector(".os-window-title");
      if (label) label.textContent = String(title);
      if (icon !== undefined) {
        const bar = handle.el.querySelector(".os-window-titlebar");
        let image = bar?.querySelector("img");
        if (!icon) image?.remove();
        else if (image) image.src = icon;
        else if (bar) bar.prepend(h("img", { src: icon, alt: "" }));
      }
      sync();
      return true;
    },
    focus(id) {
      const changed = model.focus(id);
      sync();
      if (changed) scopedFocus(handles.get(id));
      return changed;
    },
    minimise(id) {
      const changed = model.minimise(id);
      sync();
      scopedFocus(handles.get(model.focusId));
      return changed;
    },
    maximise(id) {
      const changed = model.maximise(id);
      sync();
      scopedFocus(handles.get(model.focusId));
      return changed;
    },
    restore(id) {
      const changed = model.restore(id);
      sync();
      scopedFocus(handles.get(model.focusId));
      return changed;
    },
    modal(options) {
      if (!modals.active) modalOpener = root.ownerDocument.activeElement;
      const result = modals.push(options);
      showModal();
      return result;
    },
    list: () =>
      model
        .list()
        .map(
          ({ id, manifestId, title, icon, kind, state, rect, z, pinned }) => ({
            id,
            manifestId,
            title,
            icon,
            kind,
            state,
            rect: { ...rect },
            z,
            pinned,
            active: id === model.focusId,
          }),
        ),
    top: () => {
      const entry = model.top();
      return entry ? handles.get(entry.id) : null;
    },
    update: (state) => {
      for (const handle of handles.values())
        if (handle.model.kind !== "modal") handle.content?.update?.(state);
    },
    relayout() {
      model.relayout();
      sync();
    },
    destroy() {
      destroyed = true;
      modals.clear();
      [...handles.values()].forEach((handle) => {
        handle.content?.destroy?.();
        handle.el.remove();
      });
      handles.clear();
      layer.remove();
      scrim.remove();
      for (const [child, wasInert] of outsideInert) child.inert = wasInert;
      outsideInert.clear();
      root.ownerDocument.removeEventListener("keydown", keydown, true);
    },
  };
  return api;
}
