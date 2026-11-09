// Turns a year of GitHub days into a run of cells. A busy day takes more cells than a quiet one, and a pause between days
// leaves empty cells, so the pattern keeps its real rhythm. `pause` sets the empty cells between back-to-back days, after a
// day or two off, after a quiet week and after a longer break, so the year fits one block.
// Each entry is the index of a day, or -1 for an empty cell.
export const pack = (days, per, pause = [0, 1, 2, 3]) => {
  const cells = [];
  days.forEach(([date, count], i) => {
    if (i) {
      const gap = (Date.parse(date) - Date.parse(days[i - 1][0])) / 864e5 - 1;
      const empty = pause[gap <= 0 ? 0 : gap < 3 ? 1 : gap < 14 ? 2 : 3];
      for (let n = 0; n < empty; n++) cells.push(-1);
    }
    for (let n = 0; n < Math.ceil(count / per); n++) cells.push(i);
  });
  return cells;
};

// How the year is packed: the hero's block holds a cell per few contributions, the wall one cell per contribution.
export const HERO = { per: 6, pause: [1, 1, 2, 3] };
export const WALL = { per: 1, pause: [1, 3, 5, 11] };

// The one colour rule for every view of the year, so they all read as the same data. A day starts at a tone set by how busy it
// was and fades through its cells, so busy days read as streaks, not solid blocks. Returns a tone for each entry of a run.
const level = n => (n < 3 ? 0.24 : n < 6 ? 0.38 : n < 12 ? 0.56 : n < 24 ? 0.78 : 1);
const hash = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
export const shade = (run, days, per) => {
  let step = 0;
  return run.map((day, i) => {
    step = run[i - 1] === day ? step + 1 : 0;
    if (day < 0) return 0;
    const count = days[day][1], cells = Math.ceil(count / per);
    const tone = (0.3 + 0.7 * level(count)) * (1 - 0.62 * (step / Math.max(1, cells - 1))) * (0.72 + hash(i, day) * 0.56);
    return Math.round(Math.min(1, tone) * 100) / 100;
  });
};

// Everything the page draws from a year of days: both runs of cells, their tones, and a mark under the wall where each month begins.
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
export const year = days => {
  const hero = pack(days, HERO.per, HERO.pause), wall = pack(days, WALL.per, WALL.pause), months = [];
  wall.forEach((day, i) => {
    if (day < 0) return;
    const key = days[day][0].slice(0, 7), at = (i / wall.length) * 100;
    if (months.at(-1)?.key !== key && at - (months.at(-1)?.at ?? -9) >= 7) months.push({ key, at, label: monthName.format(new Date(days[day][0])) });
  });
  return { hero, wall, heroTones: shade(hero, days, HERO.per), wallTones: shade(wall, days, WALL.per), months };
};
