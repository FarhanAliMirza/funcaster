class SketchVote {
  constructor(slots) {
    this.slots = slots;
    this.time = 0;
    this.votes = new Map();
    this.scores = Object.fromEntries(slots.map((s) => [s, 0]));
  }
  get voting() {
    return this.time >= 90;
  }
  get finished() {
    return this.time >= 105;
  }
  step(dt) {
    this.time += dt;
  }
  vote(from, to) {
    if (
      !this.voting ||
      this.finished ||
      from === to ||
      !this.slots.includes(from) ||
      !this.slots.includes(to) ||
      this.votes.has(from)
    )
      return false;
    this.votes.set(from, to);
    this.scores[to] += 100;
    return true;
  }
  publicState() {
    return {
      voting: this.voting,
      seconds: Math.max(0, Math.ceil((this.voting ? 105 : 90) - this.time)),
      voters: [...this.votes.keys()],
    };
  }
}
module.exports = { SketchVote };
