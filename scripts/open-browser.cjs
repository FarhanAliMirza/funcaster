const { spawn } = require("node:child_process");
function openBrowser(url) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd.exe"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () =>
    console.log("Open the printed launcher URL in your browser."),
  );
  child.unref();
}
module.exports = { openBrowser };
if (require.main === module)
  openBrowser(
    `${process.env.HTTP === "1" ? "http" : "https"}://localhost:${Number(process.env.PORT) || 8443}/`,
  );
