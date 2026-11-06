export {
  games,
  gameById,
  independentViews,
  optionSchema,
} from "/core/catalog.js";
import { SEATS } from "/core/seats.js";
import { deviceStore } from "/core/device-session.js";
export const colors = SEATS.map((s) => s.color);
export const names = SEATS.map((s) => s.name);
let session, local;
try {
  session = sessionStorage;
} catch {}
try {
  local = localStorage;
} catch {}
const store = deviceStore(session, local);
export const remember = (key, value) => store.remember(key, value);
export const recalled = (key) => store.recalled(key);

export { sharedWorld } from "/core/catalog.js";
