# Multiplayer and synchronization decision

The host is the authority for the ten browser games; three lightweight party games run on the server. The relay scopes every input, action, score, snapshot and feedback packet to a room and a game-local seat. Browser games use a fixed 120 Hz runner (Kart Rush and Golf own their fixed-step rules); input and rendering remain separate.

Remote and hybrid displays use a separate read-only invite. Choose one player, two players or everyone in the display toolbar. Shared-board games show the board; independent challenges show selected boards; Kart Rush shows the selected drivers' chase cameras. Snapshot data arrives at 10 Hz and cameras smooth their follow. Phone inputs still reach the host, which must remain open. The host is never replaced by a spectator. This deliberately retains the existing authority boundary.

Host pause freezes the round clock and game stepping. Disconnected racing players are auto-driven while their seats stay reserved. Golf gives a missing player a grace period and then plays a bounded automatic shot. A reconnect reclaims the same identity. If all active phones are gone past the grace period, the game returns to its lobby.

## Lockstep spike (M10)

The regression suite drives two human karts through identical inputs at 30 and 60 rendered frames per second and checks identical rules state. This supports fixed-step replay within the tested Node runtime. It does not establish floating-point equivalence between Safari, Chromium and Firefox, nor recovery of the RNG closure from a snapshot. Decision: keep snapshots for remote views; do not ship peer lockstep or authority migration on this evidence. Most browser-authoritative results stay attested. Independent verification is available for the three server games and Slice Dojo’s bounded cursor/update log. This verifies score agreement, not whether a physical human produced the input.

## Still requires approval / physical evidence

Automatic game-authority handoff was blocked by automatic approval review because it changes security-sensitive display access and simulation ownership. The read-only alternative is implemented and tested; migration remains pending explicit approval and dedicated recovery tests. Cross-network frame latency, background-tab throttling and a one-hour four-phone thermal/soak run require real hardware before launch.
