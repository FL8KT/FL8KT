// Draws every image in this README from the same cells as jacobsoendergaard.com: a GitHub contribution cell, 14px on a 16px
// pitch, the 5×7 lettering, and one blue that only ever means live data. No dependencies, so the daily Action runs it as is.
//
//   node build.mjs          refresh data/github.json (with GITHUB_TOKEN or a signed-in gh), then draw assets/
//
// Only dates and counts come from GitHub. The repositories behind them stay private.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pack, shade, year, HERO } from './lib/pack.mjs';

const here = path => new URL(path, import.meta.url);
const read = path => readFileSync(here(path));
const LOGIN = 'FL8KT';

// 1. The year on GitHub. The public calendar counts private contributions too, so the Action's own token is enough.
let token = process.env.GITHUB_TOKEN;
if (!token) { try { token = execSync('gh auth token', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {} }
if (token) {
  try {
    const query = `{ user(login: "${LOGIN}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`;
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': LOGIN },
      body: JSON.stringify({ query }),
    });
    const { data, errors } = await res.json();
    const calendar = data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) throw new Error(JSON.stringify(errors ?? res.status));
    const days = calendar.weeks.flatMap(week => week.contributionDays).filter(day => day.contributionCount).map(day => [day.date, day.contributionCount]);
    writeFileSync(here('data/github.json'), JSON.stringify({ total: calendar.totalContributions, days }) + '\n');
    console.log(`github: ${calendar.totalContributions} contributions`);
  } catch (error) {
    if (process.env.CI) throw error; // A failed run in the Action, so the daily refresh never goes quietly stale.
    console.log(`github: fetch failed, keeping the snapshot (${error.message})`);
  }
} else console.log('github: no token, keeping the snapshot');

const github = JSON.parse(read('data/github.json'));
const glyphs = JSON.parse(read('data/glyphs.json'));
const font = read('fonts/schibsted-grotesk-subset.woff2').toString('base64');
const b64 = path => read(path).toString('base64');

// 2. The two themes, the site's own tokens.
const themes = {
  dark: { bg: '#0e1014', ink: '#f2f4f7', ink2: 'rgba(242,244,247,.83)', ink3: 'rgba(242,244,247,.66)', line: 'rgba(242,244,247,.14)', cell: 'rgba(242,244,247,.075)', accent: '#659eff', surface: '#171a1f' },
  light: { bg: '#f3f3f5', ink: '#1d1d1f', ink2: 'rgba(29,29,31,.72)', ink3: 'rgba(29,29,31,.6)', line: 'rgba(29,29,31,.12)', cell: 'rgba(29,29,31,.06)', accent: '#1a5cff', surface: '#e8e8eb' },
};

const W = 1200, M = 56, GAP = 0.14;
const SETTLE = 'cubic-bezier(.16,1,.3,1)';
const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ms = n => `${Math.round(n)}ms`;

// Every image shares one sheet: the font, the arrivals, and a still page under reduced motion. Each arrival plays once, the
// way the site's do; only the live cell keeps breathing.
const sheet = t => `<style>
@font-face{font-family:S;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400 900}
text{font-family:S,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-kerning:normal}
.c{transform-box:fill-box;transform-origin:center;animation:pop .56s ${SETTLE} both;animation-delay:var(--d)}
.f{animation:fade .6s linear both;animation-delay:var(--d)}
.r{animation:rise .8s ${SETTLE} both;animation-delay:var(--d)}
.live{transform-box:fill-box;transform-origin:center;animation:pop .56s ${SETTLE} both var(--d),live 2.4s ease-in-out calc(var(--d) + 1.2s) infinite}
.ring{transform-box:fill-box;transform-origin:center;fill:none;stroke:${t.accent};stroke-width:1.5;opacity:0;animation:ring 2.4s ${SETTLE} calc(var(--d) + 1.2s) infinite}
@keyframes pop{from{opacity:0;transform:scale(.25)}}
@keyframes fade{from{opacity:0}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}}
@keyframes live{0%,100%{fill-opacity:1}50%{fill-opacity:.45}}
@keyframes ring{0%{opacity:.9;transform:scale(1)}60%,100%{opacity:0;transform:scale(2.6)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.ring{display:none}}
</style>`;

const svg = (t, w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${sheet(t)}<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="${t.bg}" stroke="${t.line}"/>${body}</svg>`;

// The empty grid, as one pattern instead of a thousand rects. `fade` lets it run out under whatever sits below it.
let grids = 0;
const grid = (t, x, y, cols, rows, pitch, fade = 0) => {
  const id = `g${grids++}`, size = pitch * (1 - GAP);
  const mask = fade ? `<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="${1 - fade}" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}m"><rect x="${x}" y="${y}" width="${cols * pitch}" height="${rows * pitch}" fill="url(#${id}f)"/></mask>` : '';
  return `<defs><pattern id="${id}" x="${x}" y="${y}" width="${pitch}" height="${pitch}" patternUnits="userSpaceOnUse"><rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${t.cell}"/></pattern>${mask}</defs><rect x="${x}" y="${y}" width="${cols * pitch - pitch * GAP}" height="${rows * pitch - pitch * GAP}" fill="url(#${id})"${fade ? ` mask="url(#${id}m)"` : ''}/>`;
};
const rect = (x, y, size, fill, cls, delay, extra = '') => `<rect class="${cls}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" rx="${(size * 0.2).toFixed(2)}" fill="${fill}" style="--d:${ms(delay)}"${extra}/>`;

// Lettering on the cells, column x, row y. Returns the lit cells as [x, y].
const letters = (line, x0 = 0, y0 = 0) => [...line].flatMap((char, i) => (glyphs[char] ?? glyphs[' '] ?? []).flatMap((row, y) => [...row].flatMap((on, x) => (on === '#' ? [[x0 + i * 6 + x, y0 + y]] : []))));
const lettersWide = line => [...line].length * 6 - 1;

// The most recent day lights last and keeps breathing, with a ring that leaves it now and then: blue is live.
const liveCell = (x, y, size, t, delay) => `${rect(x, y, size, t.accent, 'live', delay)}<rect class="ring" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" rx="${(size * 0.2).toFixed(2)}" style="--d:${ms(delay)}"/>`;

// 3. The banner: the site's hero. The name on the cells with my last year beside JACOB, then the line.
const banner = t => {
  const cols = 71, rows = 22, pitch = (W - M * 2) / (cols - GAP), size = pitch * (1 - GAP), top = M;
  const at = (x, y) => [M + x * pitch, top + y * pitch];
  let body = grid(t, M, top, cols, rows, pitch, 0.45);
  // The name arrives as one diagonal wave, like the site's opening sweep.
  [...letters('JACOB', 0, 0), ...letters('SOENDERGAARD', 0, 9)].forEach(([x, y]) => { body += rect(...at(x, y), size, t.ink, 'c', 80 + (x + y) * 11); });
  // The year packed into the block beside JACOB, oldest on the left, the way the hero packs it.
  const left = 31, block = (cols - left) * 7, full = pack(github.days, HERO.per, HERO.pause);
  const run = full.slice(-block), tones = shade(full, github.days, HERO.per).slice(-block), pad = block - run.length;
  let last = -1;
  run.forEach((day, i) => { if (day >= 0) last = i; });
  run.forEach((day, i) => {
    if (day < 0) return;
    const x = left + Math.floor((i + pad) / 7), y = (i + pad) % 7, delay = 520 + (x - left) * 16 + y * 6;
    if (i === last) body += liveCell(...at(x, y), size, t, delay);
    else body += rect(...at(x, y), size, t.accent, 'c', delay, ` fill-opacity="${tones[i]}"`);
  });
  const base = top + 16 * pitch;
  body += `<text class="r" style="--d:760ms" x="${M}" y="${base + 92}" font-size="60" font-weight="500" letter-spacing="-2.4" fill="${t.ink}">I build AI agents, automation</text>`;
  body += `<text class="r" style="--d:820ms" x="${M}" y="${base + 155}" font-size="60" font-weight="500" letter-spacing="-2.4" fill="${t.ink}">and native iPhone apps.</text>`;
  const facts = ['AI agents &amp; automation developer', 'Computer Science, Aalborg University', 'Copenhagen'];
  body += `<text class="f" style="--d:980ms" x="${M}" y="${base + 214}" font-size="23" fill="${t.ink2}">${facts.join('<tspan fill="' + t.ink3 + '">   ·   </tspan>')}</text>`;
  return svg(t, W, Math.round(base + 214 + M), body, 'Jacob Soendergaard. I build AI agents, automation and native iPhone apps.');
};

// 4. A section title, the site's Title style, with the rule under it that every section on the site opens with.
const title = (t, text, note = '') => {
  const h = 92;
  const body = `<text class="r" style="--d:60ms" x="2" y="54" font-size="44" font-weight="500" letter-spacing="-1.3" fill="${t.ink}">${esc(text)}</text>${note ? `<text class="f" style="--d:200ms" x="${W - 2}" y="54" text-anchor="end" font-size="19" fill="${t.ink3}">${esc(note)}</text>` : ''}<rect class="f" style="--d:120ms" x="0" y="${h - 1}" width="${W}" height="1" fill="${t.line}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" aria-label="${esc(text)}"><title>${esc(text)}</title>${sheet(t)}${body}</svg>`;
};

// 5. An app card. A blue live cell for the one still being built, a quiet ink one for the one that's done.
const apps = {
  calomatic: { name: 'CaloMatic', line: 'AI calorie tracking for iPhone.', host: 'calomatic.app', status: 'In development', live: true, points: ['LiDAR measures the food on your plate', 'An adaptive coach retunes your target weekly', 'Barcode and nutrition label scan'] },
  pepnote: { name: 'PepNote', line: 'Peptide and GLP-1 tracking for iPhone.', host: 'pepnote.app', status: 'Submitted to the App Store', live: false, points: ['An AI assistant that edits records, with undo', 'One-tap dose log on one calendar', 'Vial inventory that knows your supply'] },
};
const card = (t, key) => {
  // Full width, so it reads at the same scale as everything else, on a phone too.
  const app = apps[key], w = W, h = 324, p = 48, icon = 128, x0 = p + icon + 40;
  let body = `<defs><clipPath id="i"><rect x="${p}" y="${p}" width="${icon}" height="${icon}" rx="${icon * 0.2237}"/></clipPath></defs>`;
  body += `<image class="r" style="--d:60ms" href="data:image/png;base64,${b64(`icons/${key}.png`)}" x="${p}" y="${p}" width="${icon}" height="${icon}" clip-path="url(#i)"/>`;
  // The status cell, top right: live and breathing while the app is being built.
  const s = 16, sx = w - p - s, sy = p + 2;
  body += app.live ? liveCell(sx, sy, s, t, 400) : rect(sx, sy, s, t.ink, 'c', 400, ` fill-opacity=".55"`);
  body += `<text class="f" style="--d:300ms" x="${sx - 14}" y="${sy + 14}" text-anchor="end" font-size="22" fill="${t.ink3}">${esc(app.status)}</text>`;
  body += `<text class="r" style="--d:140ms" x="${x0}" y="${p + 50}" font-size="58" font-weight="500" letter-spacing="-2.2" fill="${t.ink}">${esc(app.name)}</text>`;
  body += `<text class="r" style="--d:200ms" x="${x0}" y="${p + 94}" font-size="27" fill="${t.ink2}">${esc(app.line)}</text>`;
  body += `<text class="f" style="--d:260ms" x="${w - p}" y="${p + 94}" text-anchor="end" font-size="25" font-weight="500" fill="${t.ink}">${esc(app.host)}<tspan dx="8" fill="${t.ink3}">↗</tspan></text>`;
  app.points.forEach((point, i) => {
    const y = p + 150 + i * 42;
    body += `<rect class="f" style="--d:${ms(320 + i * 60)}" x="${x0}" y="${y - 28}" width="${w - p - x0}" height="1" fill="${t.line}"/>`;
    body += `<text class="f" style="--d:${ms(340 + i * 60)}" x="${x0}" y="${y + 2}" font-size="23" fill="${t.ink2}">${esc(point)}</text>`;
  });
  return svg(t, w, h, body, `${app.name}: ${app.line} ${app.status}.`);
};

// 6. What I do: the site's list. Each row its title, its one plain line, and the tools it's done with.
const ink = new Set(['cursor', 'openai', 'mcp']);
const icon = file => {
  const raw = read(`icons/${file}.svg`).toString();
  const [, , , vw, vh] = raw.match(/viewBox="([\d.\-]+) ([\d.\-]+) ([\d.]+) ([\d.]+)"/).map(Number);
  return { data: Buffer.from(raw).toString('base64'), ratio: vw / vh };
};
const skills = [
  { title: 'AI agents and automation', summary: 'Agents that take real actions, in PepNote, in coding tools and for clients', tools: ['claude-code', 'codex', 'openai', 'cursor', 'mcp'] },
  { title: 'Native iPhone apps', summary: 'Two complete iPhone apps, CaloMatic and PepNote, built on my own', tools: ['swift', 'xcode'], apps: ['calomatic', 'pepnote'] },
  { title: 'Backends and billing', summary: 'The accounts, data and payments both apps run on', tools: ['supabase', 'postgres', 'typescript', 'cloudflare'] },
  { title: 'Models and data', summary: 'Training and running AI models, including the calorie coach inside CaloMatic', tools: ['pytorch', 'python'] },
  { title: 'Product design', summary: 'I design what I build: both apps, their icons and this profile', tools: ['figma'] },
];
const doing = t => {
  const row = 104, top = 8, h = top + skills.length * row + 8;
  let body = `<defs><filter id="inv"><feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter></defs>`;
  skills.forEach((skill, i) => {
    const y = top + i * row, d = 80 + i * 90;
    if (i) body += `<rect class="f" style="--d:${ms(d)}" x="${M}" y="${y}" width="${W - M * 2}" height="1" fill="${t.line}"/>`;
    // A cell marks each row, as the cells mark everything on the site.
    body += rect(M, y + 34, 13.76, i === 0 ? t.accent : t.ink, 'c', d + 40, i === 0 ? '' : ' fill-opacity=".35"');
    body += `<text class="r" style="--d:${ms(d + 40)}" x="${M + 34}" y="${y + 48}" font-size="30" font-weight="500" letter-spacing="-.75" fill="${t.ink}">${esc(skill.title)}</text>`;
    body += `<text class="f" style="--d:${ms(d + 120)}" x="${M + 34}" y="${y + 82}" font-size="22" fill="${t.ink3}">${esc(skill.summary)}</text>`;
    // The tools, right-aligned, each fitted into a 30px square.
    let x = W - M;
    const marks = [...(skill.tools ?? [])].reverse();
    marks.forEach((file, n) => {
      const { data, ratio } = icon(file), boxH = 30, wide = Math.min(30, boxH * ratio), tall = wide / ratio;
      x -= 30;
      body += `<image class="f" style="--d:${ms(d + 160 + n * 40)}" href="data:image/svg+xml;base64,${data}" x="${x + (30 - wide) / 2}" y="${y + 38 + (30 - tall) / 2}" width="${wide}" height="${tall}"${t === themes.dark && ink.has(file) ? ' filter="url(#inv)"' : ''}/>`;
      x -= 14;
    });
    (skill.apps ?? []).forEach((key, n) => {
      x -= 30;
      body += `<clipPath id="a${i}${n}"><rect x="${x}" y="${y + 38}" width="30" height="30" rx="${30 * 0.2237}"/></clipPath><image class="f" style="--d:${ms(d + 300 + n * 40)}" href="data:image/png;base64,${b64(`icons/${key}.png`)}" x="${x}" y="${y + 38}" width="30" height="30" clip-path="url(#a${i}${n})"/>`;
      x -= 14;
    });
  });
  return svg(t, W, h, body, `What I do: ${skills.map(skill => `${skill.title}. ${skill.summary}.`).join(' ')}`);
};

// 7. The wall: the year, one cell per contribution, columns like the graph it comes from. It fills in reading order, then
// the newest cell stays live.
const wall = t => {
  const { wall: run, wallTones: tones, months } = year(github.days);
  const cols = 71, rows = Math.ceil(run.length / cols), pitch = (W - M * 2) / (cols - GAP), size = pitch * (1 - GAP);
  const top = M + 196;
  let body = `<text class="r" style="--d:60ms" x="${M - 6}" y="${M + 118}" font-size="150" font-weight="500" letter-spacing="-9" fill="${t.ink}">${github.total}<tspan dx="24" font-size="40" letter-spacing="-1" font-weight="500">contributions</tspan></text>`;
  body += `<text class="f" style="--d:200ms" x="${M}" y="${M + 164}" font-size="20" fill="${t.ink2}">On GitHub in the last 12 months, mostly in private repositories. Refreshed daily.</text>`;
  body += grid(t, M, top, cols, rows, pitch);
  let last = -1;
  run.forEach((day, i) => { if (day >= 0) last = i; });
  const FILL = 2200;
  run.forEach((day, i) => {
    if (day < 0) return;
    const x = M + Math.floor(i / rows) * pitch, y = top + (i % rows) * pitch, delay = 300 + (i / run.length) * FILL;
    if (i === last) body += liveCell(x, y, size, t, delay);
    else body += rect(x, y, size, t.accent, 'c', delay, ` fill-opacity="${Math.max(0.35, tones[i])}"`);
  });
  // The month axis, under the columns it names.
  const span = (run.length / (cols * rows)) * (cols * pitch - pitch * GAP), axis = top + rows * pitch + 26;
  months.forEach(({ label, at }, n) => {
    const x = M + (at / 100) * span;
    body += `<rect class="f" style="--d:${ms(300 + (at / 100) * FILL)}" x="${x.toFixed(2)}" y="${axis - 18}" width="1" height="6" fill="${t.ink3}"/><text class="f" style="--d:${ms(300 + (at / 100) * FILL)}" x="${x.toFixed(2)}" y="${axis + 4}" font-size="16" fill="${t.ink3}">${label}</text>`;
  });
  return svg(t, W, Math.round(axis + M - 10), body, `${github.total} contributions on GitHub in the last 12 months, mostly in private repositories.`);
};

// 8. The close: LET'S TALK in the cells, the way the site ends, and the address under it.
const talk = t => {
  const line = 'LET’S TALK'.replace('’', "'"), cols = 71, pitch = (W - M * 2) / (cols - GAP), size = pitch * (1 - GAP), top = M;
  const lit = letters(line, Math.floor((cols - lettersWide(line)) / 2), 2);
  let body = grid(t, M, top, cols, 11, pitch, 0.35);
  lit.forEach(([x, y]) => { body += rect(M + x * pitch, top + y * pitch, size, t.ink, 'c', 80 + (x + y) * 12); });
  const base = top + 11 * pitch;
  body += `<text class="r" style="--d:900ms" x="${M}" y="${base + 72}" font-size="40" font-weight="500" letter-spacing="-1" fill="${t.ink}">hi@jacobsoendergaard.com</text>`;
  body += `<text class="f" style="--d:1040ms" x="${M}" y="${base + 114}" font-size="20" fill="${t.ink3}">jacobsoendergaard.com<tspan dx="18">·</tspan><tspan dx="18">Copenhagen</tspan></text>`;
  return svg(t, W, Math.round(base + 114 + M - 6), body, "Let's talk: hi@jacobsoendergaard.com");
};

// 9. Write both themes of everything.
mkdirSync(here('assets'), { recursive: true });
const out = (name, theme, text) => writeFileSync(here(`assets/${name}-${theme}.svg`), text);
for (const [name, t] of Object.entries(themes)) {
  grids = 0;
  out('banner', name, banner(t));
  out('title-work', name, title(t, 'Two apps, designed and built by me'));
  out('title-skills', name, title(t, 'What I do'));
  out('title-year', name, title(t, 'The year'));
  out('card-calomatic', name, card(t, 'calomatic'));
  out('card-pepnote', name, card(t, 'pepnote'));
  out('skills', name, doing(t));
  out('wall', name, wall(t));
  out('talk', name, talk(t));
}
console.log('assets: drawn');
