import test from "node:test";
import assert from "node:assert/strict";
import { recoverConnection } from "./shell/connection.js";
test("recovery reloads a failed boot or stale build; only ended rooms create new parties", () => {
  const calls = [];
  const session = {
    reconnect: () => calls.push("reconnect"),
    newParty: () => calls.push("newParty"),
  };
  const reload = () => calls.push("reload");
  recoverConnection({ connection: "error" }, null, reload);
  recoverConnection({ connection: "update" }, session, reload);
  recoverConnection({ connection: "ended" }, session, reload);
  recoverConnection({ connection: "reconnecting" }, session, reload);
  assert.deepEqual(calls, ["reload", "reload", "newParty", "reconnect"]);
});
