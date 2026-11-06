"use strict";
const {
  WORDS,
  normalizeWord: normalize,
  safeWord,
  cleanWords,
} = require("../core/drawing-words.js");
const { seededRandom } = require("../core/random.js");
class SketchRound {
  constructor(slots, seed, setup = {}) {
    this.language = ["en", "hi", "hinglish"].indexOf(setup.language);
    if (this.language < 0) this.language = 0;
    const custom = cleanWords(setup.customWords);
    this.deck = custom.length
      ? custom.map((w) => [w, w, w])
      : WORDS.filter(
          (w) =>
            !setup.theme || setup.theme === "mixed" || w[3] === setup.theme,
        );
    if (!this.deck.length) this.deck = WORDS;
    this.deck = [...this.deck];
    const rng = seededRandom(seed);
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    this.attempts = {};
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
    return this.deck[this.index % this.deck.length][this.language];
  }
  guess(slot, value) {
    if (
      this.finished ||
      this.reveal ||
      slot === this.drawer ||
      !this.slots.includes(slot) ||
      this.guessed.has(slot) ||
      typeof value !== "string" ||
      value.length > 60 ||
      !safeWord(value) ||
      (this.attempts[slot] || 0) >= 5
    )
      return false;
    this.attempts[slot] = (this.attempts[slot] || 0) + 1;
    if (
      !this.deck[this.index % this.deck.length]
        .slice(0, 3)
        .some((w) => normalize(value) === normalize(w))
    )
      return false;
    this.guessed.add(slot);
    this.scores[slot] += Math.max(
      20,
      100 +
        Math.floor(Math.max(0, 30 - this.elapsed) * 2) -
        (this.attempts[slot] - 1) * 10,
    );
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
        this.attempts = {};
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
        this.reveal > 0
          ? this.word
          : this.word.replace(/[\p{L}\p{M}]/gu, "_ ").trim(),
      scores: this.scores,
    };
  }
  privateState(slot) {
    return {
      ...this.publicState(),
      word: slot === this.drawer ? this.word : null,
      guessed: this.guessed.has(slot),
      attemptsLeft: Math.max(0, 5 - (this.attempts[slot] || 0)),
    };
  }
}
module.exports = { SketchRound };
