import test from "node:test";
import assert from "node:assert/strict";
import { Rally } from "./logic.js";
test("opposing humans own independent paddle positions", () => {
  const r = new Rally();
  r.setPaddle(0.1, 0.2);
  const p = { ...r.paddle };
  r.setOpponent(0.9, 0.8);
  assert.deepEqual(r.paddle, p);
  assert.equal(r.humanOpponent, true);
  assert.notEqual(r.paddle.x, r.aiPaddle.x);
  r.humanOpponent = false;
  assert.equal(r.humanOpponent, false);
});
