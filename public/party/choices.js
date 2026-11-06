export function enhanceOptions(root) {
  const pairs = [];
  for (const select of root.querySelectorAll(".setup-fields select")) {
    const group = document.createElement("div");
    group.className = "choice-group";
    group.setAttribute("role", "group");
    group.setAttribute(
      "aria-label",
      select.closest("label").textContent.split("\n")[0].trim() ||
        "Match option",
    );
    const rebuild = () => {
      group.replaceChildren();
      for (const option of select.options) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = option.textContent;
        b.dataset.value = option.value;
        b.onclick = (e) => {
          e.preventDefault();
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        };
        group.append(b);
      }
    };
    select.hidden = true;
    select.after(group);
    pairs.push({ select, group, rebuild });
    rebuild();
  }
  return () => {
    for (const { select, group, rebuild } of pairs) {
      if (group.children.length !== select.options.length) rebuild();
      for (const b of group.children) {
        const option = [...select.options].find(
          (o) => o.value === b.dataset.value,
        );
        b.setAttribute(
          "aria-pressed",
          String(select.value === b.dataset.value),
        );
        b.disabled = select.disabled || !!option?.disabled;
        b.hidden = !!option?.hidden;
        b.textContent = option?.textContent || b.textContent;
      }
    }
  };
}
export function focusNavigation(root) {
  root.addEventListener("keydown", (e) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) ||
      e.target.matches("input,textarea,select")
    )
      return;
    const choices = [
      ...root.querySelectorAll("button:not(:disabled),a[href],summary"),
    ].filter((el) => el.getClientRects().length);
    const i = choices.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const delta = ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1;
    choices[(i + delta + choices.length) % choices.length].focus();
  });
}
