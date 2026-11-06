"use strict";
const WORDS = [
  "rocket",
  "bicycle",
  "pizza",
  "butterfly",
  "snowman",
  "rainbow",
  "guitar",
  "cactus",
  "sailboat",
  "cupcake",
  "umbrella",
  "volcano",
  "robot",
  "octopus",
  "castle",
  "sunflower",
  "penguin",
  "telescope",
  "elephant",
  "helicopter",
];
const normalize = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
class SketchRound {
  constructor(slots, seed) {
    this.slots = [...slots];
    this.seed = seed;
    this.index = 0;
    this.elapsed = 0;
    this.reveal = 0;
    this.finished = false;
    this.scores = Object.fromEntries(slots.map((s) => [s, 0]));
    this.guessed = new Set();
  }
  get drawer() {
    return this.slots[this.index];
  }
  get word() {
    return WORDS[((this.seed >>> 0) + this.index * 7) % WORDS.length];
  }
  guess(slot, value) {
    if (
      this.finished ||
      this.reveal ||
      slot === this.drawer ||
      !this.slots.includes(slot) ||
      this.guessed.has(slot) ||
      typeof value !== "string" ||
      value.length > 60
    )
      return false;
    if (normalize(value) !== normalize(this.word)) return false;
    this.guessed.add(slot);
    this.scores[slot] += 100 + Math.floor(Math.max(0, 30 - this.elapsed) * 2);
    this.scores[this.drawer] += 60;
    if (this.guessed.size === this.slots.length - 1) this.reveal = 3;
    return true;
  }
  step(dt) {
    if (this.finished || !Number.isFinite(dt) || dt <= 0) return false;
    if (this.reveal > 0) {
      this.reveal = Math.max(0, this.reveal - dt);
      if (this.reveal === 0) {
        this.index++;
        this.finished = this.index >= this.slots.length;
        this.elapsed = 0;
        this.guessed.clear();
        return true;
      }
    } else {
      this.elapsed += dt;
      if (this.elapsed >= 30) this.reveal = 3;
    }
    return false;
  }
  publicState() {
    return {
      drawer: this.drawer,
      turn: this.index,
      total: this.slots.length,
      seconds: Math.max(0, Math.ceil(30 - this.elapsed)),
      reveal: this.reveal > 0,
      label:
        this.reveal > 0 ? this.word : this.word.replace(/[a-z]/g, "_ ").trim(),
      scores: this.scores,
    };
  }
  privateState(slot) {
    return {
      ...this.publicState(),
      word: slot === this.drawer ? this.word : null,
      guessed: this.guessed.has(slot),
    };
  }
}
module.exports = { SketchRound };
