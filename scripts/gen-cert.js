"use strict";

/**
 * Self-signed cert generator.
 *
 * Why this exists: DeviceOrientationEvent.requestPermission() only resolves in a
 * secure context. `http://192.168.x.x` is NOT a secure context, so a plain-HTTP
 * LAN server can never read the phone's IMU. HTTPS with a self-signed cert is —
 * you just have to click through the browser warning once on the phone.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { X509Certificate } = require("node:crypto");

const CERT_DIR = path.join(__dirname, "..", "certs");
const KEY_PATH = path.join(CERT_DIR, "key.pem");
const CRT_PATH = path.join(CERT_DIR, "cert.pem");

/** Prefer real LAN adapters over WSL/Hyper-V virtual NICs for QR URLs and certs. */
const PREFER_IFACE = /^(Wi-?Fi|WLAN|Ethernet|en\d+)/i;
const SKIP_IFACE = /^(Loopback|vEthernet|Npcap|VMware|VirtualBox|TAP-|Bluetooth|Hyper-V)/i;

function ifaceRank(name) {
  if (PREFER_IFACE.test(name)) return 0;
  if (SKIP_IFACE.test(name)) return 2;
  return 1;
}

/** Every non-internal IPv4 address, best LAN candidate first. */
function localAddresses() {
  const entries = [];
  for (const [name, ifaces] of Object.entries(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === "IPv4" && !iface.internal)
        entries.push({ name, address: iface.address });
    }
  }
  entries.sort(
    (a, b) =>
      ifaceRank(a.name) - ifaceRank(b.name) ||
      a.address.localeCompare(b.address),
  );
  return entries.map((e) => e.address);
}

/** Does the existing cert still cover every address we're about to serve on? */
function certCoversCurrentIps(quiet) {
  try {
    const cert = new X509Certificate(fs.readFileSync(CRT_PATH));
    if (Date.parse(cert.validTo) <= Date.now()) return false;
    const missing = ["127.0.0.1", ...localAddresses()].filter(
      (ip) => !cert.checkIP(ip),
    );
    if (missing.length && !quiet) {
      console.log(
        `[cert] regenerating — cert predates current address ${missing.join(", ")}`,
      );
    }
    return missing.length === 0;
  } catch {
    return false;
  }
}

function ensureCert({ quiet = false } = {}) {
  // A cert pinned to an old DHCP lease still loads, but the phone then hits a
  // NAME_INVALID error that looks nothing like "self-signed" — so check the
  // SANs rather than just the file's existence.
  if (
    fs.existsSync(KEY_PATH) &&
    fs.existsSync(CRT_PATH) &&
    certCoversCurrentIps(quiet)
  ) {
    return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CRT_PATH) };
  }

  fs.mkdirSync(CERT_DIR, { recursive: true });

  const ips = localAddresses();
  const altNames = [
    "DNS:localhost",
    "IP:127.0.0.1",
    ...ips.map((ip) => `IP:${ip}`),
  ].join(",");

  try {
    const generated = require("./local-cert.cjs").createLocalCertificate(ips);
    fs.writeFileSync(KEY_PATH, generated.key, { mode: 0o600 });
    fs.writeFileSync(CRT_PATH, generated.cert, { mode: 0o644 });
  } catch (err) {
    if (!quiet) {
      console.error(
        "[cert] Local certificate generation failed — falling back to plain HTTP.",
      );
      console.error("[cert]", err.message);
    }
    return null;
  }

  if (!quiet) console.log(`[cert] generated self-signed cert for ${altNames}`);
  return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CRT_PATH) };
}

module.exports = { ensureCert, localAddresses, CERT_DIR };

if (require.main === module) ensureCert();
