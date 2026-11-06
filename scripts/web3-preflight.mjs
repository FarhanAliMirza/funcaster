import { pathToFileURL } from "node:url";
import { loadConfig } from "../integrations/shared/config.mjs";
export function preflight(env, { mock = false, role = "relay" } = {}) {
  const config = loadConfig(
    { ...env, PARTNERS: env.PARTNERS || (mock ? "mock" : "off") },
    { role },
  );
  const rows = [
    ["config", "PASS"],
    ["play money", config.PLAY_MONEY === "1" ? "PASS" : "FAIL"],
  ];
  if (config.ARC_CHAIN_ID !== 5042002)
    throw new Error(
      "This build supports testnets only; mainnet preflight is disabled.",
    );
  for (const key of [
    "WEB3_ENS",
    "WEB3_ARC",
    "WEB3_ARKIV",
    "MARKETS",
    "STREAMERS",
  ])
    rows.push([
      key,
      config[key] === "on"
        ? "UNVERIFIED (real preflight not implemented)"
        : config[key].toUpperCase(),
    ]);
  if (rows.some(([, status]) => status.startsWith("UNVERIFIED")))
    return { ok: false, rows };
  rows.push([
    "network",
    mock ? "SKIPPED (--mock: offline only)" : "OFF (no live providers enabled)",
  ]);
  return { ok: true, rows };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const flags = process.argv.slice(2);
    if (flags.some((f) => f !== "--mock"))
      throw new Error("Usage: web3-preflight.mjs [--mock]");
    const result = preflight(process.env, { mock: flags.includes("--mock") });
    for (const [name, status] of result.rows)
      console.log(`${name.padEnd(18)} ${status}`);
    console.log(
      result.ok
        ? "PASS: configuration only; no live-chain claims."
        : "FAIL: run the pending G0 checks before enabling real providers.",
    );
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
