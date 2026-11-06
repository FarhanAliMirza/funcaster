const { FruitNinja } = require("../games/fruit-ninja/logic.js");
const { seededRandom } = require("../core/random.js");
class SliceReplay {
  constructor(seed, setup = {}) {
    this.game = new FruitNinja({
      aspect: 16 / 9,
      infiniteLives: true,
      rng: seededRandom(seed),
    });
    this.game.spawnRng = seededRandom(seed);
    if (setup.variant)
      this.game.configure({
        variant: setup.variant,
        seats: setup.seats || 1,
        bot: setup.bot,
      });
    this.sequence = 0;
    this.calls = [];
    this.bytes = 0;
    this.valid = true;
    this.started = false;
    this.steps = 0;
  }
  accept(sequence, calls) {
    if (
      !this.valid ||
      sequence !== this.sequence ||
      !Array.isArray(calls) ||
      calls.length > 1500
    )
      return (this.valid = false);
    const bytes = JSON.stringify(calls).length;
    if (this.bytes + bytes > 6000000) return (this.valid = false);
    for (const call of calls) {
      if (!Array.isArray(call) || call.length > 5) {
        this.valid = false;
        break;
      }
      const [method, ...args] = call;
      if (args.some((a) => !Number.isFinite(a))) {
        this.valid = false;
        break;
      }
      if (method === "start" && args.length === 1 && !this.started) {
        this.started = true;
        this.game.start(args[0]);
      } else if (
        method === "setAspect" &&
        args.length === 1 &&
        Math.abs(args[0] - 16 / 9) < 0.00001
      )
        this.game.setAspect(args[0]);
      else if (
        this.started &&
        method === "setCursor" &&
        args.length === 4 &&
        Math.abs(args[0]) <= 12 &&
        Math.abs(args[1]) <= 8 &&
        Number.isInteger(args[3]) &&
        args[3] >= 0 &&
        args[3] < 4
      )
        this.game.setCursor(...args);
      else if (
        this.started &&
        method === "update" &&
        args.length === 2 &&
        Math.abs(args[1] - 1 / 120) < 1e-8 &&
        ++this.steps <= 16000
      )
        this.game.update(...args);
      else {
        this.valid = false;
        break;
      }
    }
    if (!this.valid) return false;
    this.bytes += bytes;
    this.calls.push(...calls);
    this.sequence++;
    return true;
  }
  score(slot, cooperative = false) {
    return cooperative
      ? this.game.state.score
      : this.game.players.get(slot)?.score || 0;
  }
}
function verifySlice(replay, scores) {
  const boards = replay.boards || [];
  if (!boards.length) return false;
  const actual = new Map();
  for (const board of boards) {
    const checker = new SliceReplay(replay.seed, {
      ...replay.setup,
      seats: board.view >= 0 ? 1 : replay.slots.length,
    });
    for (let i = 0; i < board.calls.length; i += 1000)
      if (!checker.accept(checker.sequence, board.calls.slice(i, i + 1000)))
        return false;
    if (!checker.started) return false;
    if (board.view >= 0) actual.set(replay.slots[board.view], checker.score(0));
    else
      replay.slots.forEach((slot, i) =>
        actual.set(slot, checker.score(i, replay.setup.variant === "co-op")),
      );
  }
  return scores.every((s) => actual.get(s.slot) === s.score);
}
module.exports = { SliceReplay, verifySlice };
