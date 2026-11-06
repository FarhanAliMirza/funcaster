const test = require("node:test"),
  assert = require("node:assert/strict"),
  { X509Certificate, createPrivateKey } = require("node:crypto");
const { createLocalCertificate } = require("../../scripts/local-cert.cjs");
test("local TLS works without OpenSSL and covers selected network addresses", () => {
  const pair = createLocalCertificate(["192.168.1.12"]);
  const c = new X509Certificate(pair.cert);
  assert.equal(c.checkHost("localhost"), "localhost");
  assert.equal(c.checkIP("192.168.1.12"), "192.168.1.12");
  assert.ok(c.checkPrivateKey(createPrivateKey(pair.key)));
  assert.ok(Date.parse(c.validTo) > Date.now());
});
