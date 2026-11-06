# UI Theme.png atlas report

Sheet: `assets/source/winxp/Frame/UI Theme.png`, 1024x1024 RGBA, content only in x<860, y<800. Machine-readable data: `atlas.json` (131 role names, `colors`, `unlabelled`, `sections`, `ignore`). All coordinates below are sheet px, `x,y,w,h`. Every opaque pixel is accounted for (the only uncovered pixels are documented duplicate groups: title-button rows 8-11 and scrollbar-button groups 2 and 4).

Section heading anchors (baked light-cyan text, ignore when slicing): frames (14,17,70,15), buttons (376,17,75,15), window (15,371,76,15), taskbar (376,499,76,15). Attribution plate "packed by @NullTale" (622,90,229,23): ignore. Stray 1px dots at (59,460) (59,470) (59,480) (114..118,814): ignore.

## What is in the sheet

| Role | x,y,w,h | Layout | 9-slice [l,t,r,b] |
|---|---|---|---|
| window.frame.active | 12,42,66,66 | 4-sided, 5px border, fill #efeee0 | [5,5,5,5] |
| window.frame.opentop | 12,122,66,66 | frame minus top border | [5,0,5,5] |
| window.title.{active,inactive} | 83,393 / 83,422; 66x29 | top corners rounded (std XP caption) | [8,10,8,10] (scale X only) |
| window.title.rounded.* | 14,393 / 14,422 | all 4 corners rounded | [8,10,8,10] |
| window.title.flat.* | 152,393 / 152,422 | square (maximised) | [8,10,8,10] |
| window.border.left.{active,inactive} | 221,393,5,31 / 221,424,5,28 | side strip, tile Y, mirror for right | n/a |
| window.border.bottom.{active,inactive} | 229,393,49,5 / 229,398,49,5 | bottom strip, first 5px = corner, mirror for right | [5,0,0,0] |
| titlebtn.{min,max,restore,close,help}.\<state\> | x=375,399,423,447,471; y=236+21*row; 21x21 | rows: 0 normal, 1 hover, 2 pressed, 3 disabled, 4 inactive, 5 inactive.hover, 6 inactive.pressed, 7 inactive.disabled (rows 8-11 repeat 4-7) | [4,4,4,4] |
| titlebtn.blank.blue / .red | 398,37 / 422,37; 21x21 | glyph-less base, 8 rows pitch 21, same order | [4,4,4,4] |
| closebtn.mini.{normal,hover,pressed} | 94,42 / 94,60 / 94,78; 17x18 | cream/orange tooltip-style X | none |
| button.{normal,hover,pressed,disabled,default} | 375,37+23k; 20x23 | body 18x21 at +1,+1, 1px #003c74 outline, r=3 | [4,4,4,4] |
| checkbox.* (default, XP 13px) | x=144, y=42+13k; 13x13 | k=0..11: unchecked / checked / mixed x normal, hover, pressed, disabled | none |
| checkbox16.* | x=160, y=42+16k; 16x16 | same order | none |
| checkbox25.* | x=179, y=42+25k; 25x25 | same order | none |
| checkbox13s.* | x=125, y=42+16k; 13x13 in 16x16 cell (3px shadow) | same order | none |
| scrollbar.button.v | 14,521+17k; 17x17 | k=0..3 normal,hover,pressed,disabled (group repeats at y=589) | [4,4,4,4] |
| scrollbar.button.h | 14,657+17k; 17x17 | same (repeats at y=725) | [4,4,4,4] |
| scrollbar.arrow.left / .right | 119 / 183, y=521; 16x16 cells, x+16k | normal, hover, pressed, disabled; own bg | none |
| scrollbar.thumb.v | 34,521+22k; 15x22 | 4 states | [4,4,4,4] |
| scrollbar.thumb.h | 250,521+15k; 22x15 | 4 states | [4,4,4,4] |
| scrollbar.track.h (uncertain) | 52+16k,521; 16x16 | white / light-blue / mid-blue / beige | none |
| taskbar.bar | 375,519,50,28 | tile in X | [0,3,0,2] |
| taskbar.bar.vertical | 428,519,28,41 | tile in Y | [3,0,2,0] |
| taskbar.task.{normal,hover,active,normal2,active2,normal3} | 460,519+23k; 26x23 | set A, touching cells | [4,4,4,4] |
| taskbar.taskB.* | 490,522+28k; 26x23 | set B, gapped, rounder | [4,4,4,4] |
| taskbar.slot (cell0..15) | 519,519+17k; 17x17 | inset square buttons, purpose unknown | [4,4,4,4] |
| taskbar.chevron.double | 95,131+9k; 8x5 (6 identical) | black >> | none |
| taskbar.chevron.down | 107,128+7k; 9x6 | k0-2 #4d6185, k3 disabled #c9c9c2 | none |
| start.{normal,hover,pressed} | 497,37 / 70 / 103; 97x31 | green pill, no label | [6,6,14,6] |
| start.logo | 599,37,20,18 | flag icon (core 602,39,17,16) | none |
| go.arrow.{normal,hover} | 626,37 / 645,37; 16x24 | green triangles | none |

Unlabelled (see `unlabelled` in JSON): light-blue 23px-high pieces at x=240 (w20), 263 (w24), 290 (w11), y=42/65/111/134, i.e. left/middle/right cap of a segmented tab/toolbar/list-header control (gradient, blue pressed, white, gradient); plus a 20x25 pale-blue gradient tile at (217,42).

Notes: the window frame has no separate corner sprites (corners are baked into the 66x66 frame and title bars). The default checkbox "mixed" state is a filled green square. Up/down scrollbar arrows are absent; rotate the left/right arrows. Title-button glyph and blank bases are both provided (glyph versions already composite the base).

## Missing for a full XP-style kit, and what to do

Colours in the recommendations that also appear in the sprite tables are sampled; the rest (tab border #919b9c, menu #316ac5, etc.) are standard Luna values, not from this sheet.

| Missing | Recommendation (CSS, use these exact colours) |
|---|---|
| Radio buttons (round) | CSS circle 13px, border #1c5180, bg gradient #e2e2de to #fbfbfa, dot #21a121; hover ring #ffedc6/#fee4ac; or reuse checkbox mixed (green square) as "on" if a square look is acceptable |
| Tabs / tab pages | CSS: tab bg gradient #ffffff to #ece9d8, border #919b9c, selected top 3px #ffc73c; or reuse the light-blue segmented pieces (unlabelled) |
| Menu bar / popup / highlight | bar #ece9d8; popup bg #ffffff border #aca899; highlight #316ac5 text #fff |
| Progress bar | track #ffffff border #686868; blocks 8px wide #2fd23a gradient (green stops from start button: #8abc89 to #41a041 to #44b644) |
| Group box | 1px #d0d0bf border, r=4, legend #0046d5 |
| Combo/dropdown arrow | reuse taskbar.chevron.down or scrollbar.button.v with CSS-rotated scrollbar.arrow; button bg #c6d6fd, border #7c9fd3 |
| Tooltip | bg #ffffe1, border #000, 1px; or use closebtn.mini colours (#ffffe1 / #c7bea6) |
| Text input / list border | 1px #7f9db9, inner bg #fff |
| Scrollbar up/down arrows | rotate scrollbar.arrow.left/right 90deg |
| Slider/trackbar, spinner, status bar, resize grip, separators, start menu, tray clock, window icon, window shadow | draw in CSS; status bar bg #ece9d8, top border #fff; tray gradient = taskbar.bar stops with #0f8cf0-ish left edge from taskbar.bar.vertical |
| Window bottom-right corner/right border | mirror window.border.left and window.border.bottom (scaleX(-1)) |

## Colour tokens (sampled; see `colors` in atlas.json for full per-row ramps)

| Token | Value |
|---|---|
| title bar active top to bottom | #4198ff, #2c8aff, #0370ff, #0465f1, #005ae7, #0055e3, #0052e4, #0050e1 (mid-upper), #004fe4 (centre), #0055f1, #005efc, #0166fe (bottom third), #0063fd, #005af8, #0046dd, #0043cf |
| title bar CSS gradient (active) | `linear-gradient(#4198ff 0%,#0370ff 7%,#0058e8 14%,#0050e1 28%,#004fe4 45%,#0055f1 58%,#005efc 70%,#0166fe 80%,#005af8 92%,#0043cf 100%)` |
| title bar inactive | #99b3e9, #88aee9, #7a9bdf, #7994de (flat middle), #7e9ee5, #81a8e9, #7e9be5, #7a92df |
| frame border (active) left outer to inner | #0019cf #0831d9 #1254e7 #166aee #0855dd |
| frame border top outer to inner | #00138c #001da0 #002ebe #003ddd #0048f1 (bottom/right are the same ramp reversed) |
| frame border inactive | #5b68cd #7480dc #7589de #758cdd #758cdc; bottom #7586dc..#4f53bc |
| window face / frame fill | #efeee0 (alt cream #f5f4ea, track #ebebe4, button low #e2dfd6) |
| push button | outline #003c74; face ramp #ffffff #fcfcfb #f6f6f3 #f3f3ef #f0f0ea #ecebe6 #e2dfd6 #d6d0c5 (top to bottom); hover ring #fff0cf, #fdd889, #f8b330, #e59700; default ring #cee7ff, #bcd4f6, #89ade4, #6982ee; pressed face #e6e6e0 to #e0e0d7; disabled #f5f4ea / border #c9c7ba |
| checkbox | border #1c5180; face #e2e2de to #fbfbfa; hover ring #ffedc6 to #f9bb43; check #21a121; disabled border #cac8bb |
| title button blue | white 1px border, face #5f8cf7 top, #3a71f5 mid, #3278f6 low, #1045be bottom |
| title button red | face #e97c62 top, #e45d3d mid, #e65d32 low, #ae3110 bottom |
| scrollbar | track #ebebe4; thumb #c6d6fd (hover #d8e8ff, pressed #a8c0fb) with #7c9fd3 edge and white outline; arrow hover bg #c7dcf6 border #6f89b0; pressed bg #9db9d9 border #667ea2 |
| taskbar bar | top #3168d5, #3888e9, #4993e6, then #307be5, #286add, body #2257d5 to #2663e0 (gradient), bottom #1e50c4, #1941a5 |
| task button | normal #4085f5 (top highlight #5a99f4); hover #559df8 (top #8ac4f8); active #164dbc (edge #184896) |
| start button normal | #3a7c3a (edge) #8cbf8c (highlight) #58a458 #459d45 #41a742 #40b040 #45b845 (lower body) #3b963b #2c743a (bottom) |
| start button hover | #238828 #8bce8c #58b959 #43b843 #42c442 #49cf49 #359d35 #2c882e |
| start button pressed | #094309 #3e783e #248524 #178717 #159015 #189718 #115e11 |
| lightblue pieces | border #a8bfea / #88a6e1 / #7a9bdd, fill #f1f4f8 to #e9eef6 |
