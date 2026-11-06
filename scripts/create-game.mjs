import fs from "node:fs";
import path from "node:path";
const slug = process.argv[2];
if (!/^[a-z][a-z0-9-]{1,40}$/.test(slug || ""))
  throw Error("Use a short lowercase name: npm run game:create -- my-game");
const dir = path.resolve("creator-games", slug);
if (fs.existsSync(dir))
  throw Error("That game already exists. Choose a new name.");
fs.mkdirSync(dir, { recursive: true });
const manifest = {
  schemaVersion: 2,
  gameId: `creator.${slug}`,
  version: "0.1.0",
  title: slug,
  view: "shared",
  verification: "casual",
  scoring: { direction: "higher", unit: "points" },
  controller: "aim",
  modes: {
    solo: { minHumans: 1, maxHumans: 1, aiDefault: 0 },
    multiplayer: { minHumans: 2, maxHumans: 4, aiDefault: 0 },
  },
  topologies: ["shared"],
  license: "MIT",
};
fs.writeFileSync(
  path.join(dir, "game.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(dir, "index.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><title>${slug}</title><canvas id="game" width="800" height="450"></canvas><script>const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');let x=400,y=225;window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='funcaster:input')return;x=400+e.data.x*300;y=225+e.data.y*160;});function draw(){ctx.fillStyle='#eeeaff';ctx.fillRect(0,0,800,450);ctx.fillStyle='#7357f5';ctx.beginPath();ctx.arc(x,y,35,0,Math.PI*2);ctx.fill();requestAnimationFrame(draw);}draw();<\/script></html>`,
);
console.log(
  `Created ${dir}. Validate it with npm run game:validate -- ${dir}; preview its HTML in /creator.`,
);
