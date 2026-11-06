import { safePlaylist } from "../window-data.js";
import { BOOT_STRINGS as S } from "../strings.js";
/** The next game becomes the head so the relay's playlistIndex reset stays correct. */
export function nextPlaylist(room) {
  const playlist = safePlaylist(room?.playlist);
  if (playlist.length < 2) return [];
  const index = (playlist.indexOf(room.game) + 1) % playlist.length;
  return [...playlist.slice(index), ...playlist.slice(0, index)];
}
export async function skipGame(session, getRoom) {
  const before = getRoom();
  if (nextPlaylist(before).length < 2) return { error: S.noNextGame };
  if (!["lobby", "results"].includes(before.phase)) {
    const reply = await session.lobby();
    if (reply?.error || reply?.cancelled) return reply;
  }
  const room = getRoom();
  if (room?.code !== before.code || !["lobby", "results"].includes(room?.phase))
    return { error: S.skipChanged };
  const playlist = nextPlaylist(room);
  if (playlist.length < 2) return { error: S.noNextGame };
  const reply = await session.setup({ playlist });
  if (reply?.error || reply?.cancelled) return reply;
  return session.select(playlist[0]);
}
