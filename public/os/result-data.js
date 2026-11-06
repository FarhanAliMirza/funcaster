import { gameById } from "../../core/catalog.js";
import { SEATS } from "../../core/seats.js";
import { GAME_STRINGS as S } from "./strings.js";
/** Presentation only: never change the server's order, rank, score or verification. */
export function resultPresentation(room) {
  const game = gameById(room.game),
    points =
      game.id === "golf" && ["skins", "match"].includes(room.match?.golfMode),
    closest = game.id === "golf" && room.match?.golfMode === "closest";
  const unit = points ? S.points : closest ? S.fromPin : game.scoring.unit;
  const name = (slot) =>
    room.players?.find((player) => player.slot === slot)?.name ||
    SEATS[slot]?.name ||
    "";
  const ranked = (room.result?.scores || []).map((score, index) => ({
    ...score,
    name: name(score.slot),
    color: SEATS[score.slot]?.color || "#fff",
    shape: SEATS[score.slot]?.shape || "",
    rank: score.rank || index + 1,
    displayScore: points
      ? -score.score
      : closest
        ? (score.score / 1000).toFixed(2)
        : score.score,
    outcomeLabel: S.outcomes[score.outcome] || "",
    statsLine: Object.entries(score.stats || {})
      .filter(([, value]) => Number.isFinite(value))
      .map(
        ([key, value]) =>
          `${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${value}`,
      )
      .join(" · "),
  }));
  const top = ranked[0],
    solo = ranked.length === 1,
    noContest = room.result?.status === "no-contest",
    unfinished =
      top &&
      ranked.every((score) =>
        ["dnf", "forfeit", "removed"].includes(score.outcome),
      ),
    tied =
      top && ranked.filter((player) => player.rank === top.rank).length > 1;
  const winner = noContest
    ? S.noContest
    : unfinished
      ? S.roundEnded
      : !top
        ? S.noScores
        : solo
          ? game.target === undefined || top.score >= game.target
            ? S.onARoll
            : S.nicely
          : tied
            ? S.tie
            : S.winner(top.name);
  const subtitle =
    noContest || unfinished
      ? S.tryAgain
      : solo
        ? S.soloSubtitle(top.displayScore, unit, game.target)
        : S.company;
  const standings = [
    room.bracket?.champion != null
      ? S.bracket(name(room.bracket.champion))
      : "",
    Object.entries(room.standings || {})
      .sort((a, b) => b[1] - a[1])
      .map(([slot, score]) => `${name(Number(slot))} ${score}`)
      .join(" · "),
  ]
    .filter(Boolean)
    .join(" · ");
  const verification = [
    S.verification[room.result?.verification] || "",
    room.result?.views?.some((view) => view.source === "remote")
      ? S.remoteResults
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return { winner, subtitle, unit, ranked, standings, verification };
}
