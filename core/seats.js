/** Seat identity shared by the room, screen and phone. */
export const SEATS = Object.freeze(
  [
    { name: "Peeli", color: "#f7c600", shape: "●", text: "#111111" },
    { name: "Magenta", color: "#ef5da8", shape: "▲", text: "#111111" },
    { name: "Cyan", color: "#4de2df", shape: "■", text: "#111111" },
    { name: "Marigold", color: "#ffad42", shape: "◆", text: "#111111" },
  ].map(Object.freeze),
);
export const ROOM_SEATS = SEATS.length;
export const seatIdentity = (slot) => SEATS[slot] || SEATS[0];
