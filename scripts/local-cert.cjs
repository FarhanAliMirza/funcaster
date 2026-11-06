const {
  generateKeyPairSync,
  randomBytes,
  sign,
  X509Certificate,
} = require("node:crypto");
const length = (n) =>
  n < 128
    ? Buffer.from([n])
    : (() => {
        const a = [];
        while (n) {
          a.unshift(n & 255);
          n >>>= 8;
        }
        return Buffer.from([128 + a.length, ...a]);
      })();
const der = (tag, ...parts) => {
  const b = Buffer.concat(
    parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p))),
  );
  return Buffer.concat([Buffer.from([tag]), length(b.length), b]);
};
const seq = (...p) => der(0x30, ...p),
  integer = (n) => der(2, Buffer.from([n]));
const oid = (s) => {
  const a = s.split(".").map(Number),
    b = [a[0] * 40 + a[1]];
  for (const n0 of a.slice(2)) {
    let n = n0,
      v = [n & 127];
    while ((n >>>= 7)) v.unshift((n & 127) | 128);
    b.push(...v);
  }
  return der(6, Buffer.from(b));
};
const pem = (name, b) =>
  `-----BEGIN ${name}-----\n${b
    .toString("base64")
    .match(/.{1,64}/g)
    .join("\n")}\n-----END ${name}-----\n`;
function createLocalCertificate(ips, now = new Date()) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const alg = seq(oid("1.2.840.113549.1.1.11"), der(5, Buffer.alloc(0))),
    name = seq(
      der(0x31, seq(oid("2.5.4.3"), der(12, Buffer.from("Funcaster local")))),
    );
  const time = (d) =>
    der(
      0x17,
      Buffer.from(d.toISOString().replace(/[-:T]/g, "").slice(2, 14) + "Z"),
    );
  const serial = randomBytes(16);
  serial[0] &= 127;
  const alt = [
    der(0x82, Buffer.from("localhost")),
    ...[...new Set(["127.0.0.1", ...ips])].map((ip) => {
      const bytes = ip.split(".").map(Number);
      if (
        bytes.length !== 4 ||
        bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)
      )
        throw Error("Invalid IPv4 address");
      return der(0x87, Buffer.from(bytes));
    }),
  ];
  const extension = (id, value) => seq(oid(id), der(4, value));
  const tbs = seq(
    der(0xa0, integer(2)),
    der(2, serial),
    alg,
    name,
    seq(time(new Date(+now - 60000)), time(new Date(+now + 365 * 86400000))),
    name,
    publicKey.export({ type: "spki", format: "der" }),
    der(
      0xa3,
      seq(extension("2.5.29.17", seq(...alt)), extension("2.5.29.19", seq())),
    ),
  );
  const certificate = seq(
    tbs,
    alg,
    der(3, Buffer.from([0]), sign("sha256", tbs, privateKey)),
  );
  const cert = pem("CERTIFICATE", certificate),
    key = privateKey.export({ type: "pkcs8", format: "pem" });
  if (!new X509Certificate(cert).verify(publicKey))
    throw Error("Certificate self-check failed");
  return { cert, key };
}
module.exports = { createLocalCertificate };
