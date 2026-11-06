import { h } from "../util/h.js";
import { gameIcon } from "../icon-crop.js";
import { DESKTOP_STRINGS as S } from "../strings.js";

export function desktopLayout(width, height, ui = 1, count = 13) {
  const w = width / ui,
    h = height / ui;
  const columns = Math.max(1, Math.min(3, Math.floor((w - 32) / 108)));
  const rows = Math.max(1, Math.min(5, Math.floor((h - 126) / 110)));
  const capacity = columns * rows;
  return {
    columns,
    rows,
    capacity,
    pages: Math.max(1, Math.ceil(count / capacity)),
    cellWidth: 108,
    cellHeight: 110,
  };
}
export function mountIconGrid(
  root,
  { games, theme, scale, onGame, onWindow, contextMenu },
) {
  let page = 0,
    currentLayout;
  const grid = h("div", {
    class: "os-game-grid",
    "aria-label": S.games,
    dataset: { navGrid: "games" },
  });
  const gameButtons = games.map((game, index) =>
    h(
      "button",
      {
        class: "os-desktop-icon",
        type: "button",
        title: `${game.title} · ${game.verb}`,
        dataset: { nav: "", id: `game-${game.id}`, help: game.detail },
        onclick: () => {
          select(game.id);
          onGame(game.id);
        },
        oncontextmenu: (event) => {
          event.preventDefault();
          select(game.id);
          contextMenu?.(event, [
            { label: S.open, action: () => onGame(game.id) },
            {
              label: S.help,
              action: () => onWindow("help", { game: game.id }),
            },
          ]);
        },
        style: `--icon-index:${index}`,
      },
      gameIcon(game),
      h("span", { text: game.title }),
    ),
  );
  grid.append(...gameButtons);
  function select(id) {
    gameButtons.forEach((button) =>
      button.classList.toggle("selected", button.dataset.id === `game-${id}`),
    );
  }
  const pageText = h("span", { "aria-live": "polite" });
  const previous = h("button", {
    type: "button",
    text: "‹",
    "aria-label": S.previous,
    dataset: { nav: "", id: "previous-games" },
    onclick: () => {
      page--;
      draw();
      gameButtons[page * currentLayout.capacity].focus();
    },
  });
  const next = h("button", {
    type: "button",
    text: "›",
    "aria-label": S.next,
    dataset: { nav: "", id: "next-games" },
    onclick: () => {
      page++;
      draw();
      gameButtons[page * currentLayout.capacity].focus();
    },
  });
  const pagination = h(
    "div",
    { class: "os-icon-pages" },
    previous,
    pageText,
    next,
  );
  const system = h("nav", {
    class: "os-system-icons",
    "aria-label": S.desktop,
  });
  for (const [id, label, icon] of [
    ["my-games", S.myGames, "folder.my-games"],
    ["invite", S.invite, "invite.network"],
    ["recycle-bin", S.recycle, "recycle.empty"],
    ["help", S.help, "help"],
  ])
    system.append(
      h(
        "button",
        {
          class: "os-desktop-icon",
          title: label,
          dataset: { nav: "", id: `desktop-${id}` },
          onclick: () => onWindow(id),
        },
        h("img", { src: theme.icon(icon), alt: "" }),
        h("span", { text: label }),
      ),
    );
  root.append(grid, pagination, system);
  const blank = (event) => {
    if (event.target === root) select(null);
  };
  root.addEventListener("pointerdown", blank);
  function draw() {
    const work = scale.get();
    currentLayout = desktopLayout(
      work.work.w,
      work.work.h,
      work.ui,
      games.length,
    );
    const { columns, rows, capacity, pages } = currentLayout;
    page = Math.max(0, Math.min(page, pages - 1));
    grid.style.gridTemplateColumns = `repeat(${columns}, calc(108 * var(--px)))`;
    grid.style.gridTemplateRows = `repeat(${rows}, calc(110 * var(--px)))`;
    gameButtons.forEach((button, index) => {
      button.hidden = index < page * capacity || index >= (page + 1) * capacity;
    });
    pagination.hidden = pages === 1;
    previous.disabled = page === 0;
    next.disabled = page === pages - 1;
    pageText.textContent = S.page(
      page * capacity + 1,
      Math.min(games.length, (page + 1) * capacity),
      games.length,
    );
  }
  document.documentElement.addEventListener("os:resize", draw);
  draw();
  return {
    el: grid,
    select,
    destroy() {
      document.documentElement.removeEventListener("os:resize", draw);
      root.removeEventListener("pointerdown", blank);
      grid.remove();
      pagination.remove();
      system.remove();
    },
  };
}
