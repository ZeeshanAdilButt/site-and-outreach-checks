// DW's own seed. It is not the learner's seed. All dates are fixed (the first week of 2020), so the
// panel answers are fixed too. The expected answers are computed here from the rows, not from SQL.

export const FROM = "2020-01-01";
export const TO = "2020-01-07";
export const TOKENS = {
  ada: "dwseedtokenaaaaaaaaaaa", // opened and read
  ben: "dwseedtokenbbbbbbbbbbb", // fetched only
  cy: "dwseedtokenccccccccccc", // no visit at all
  live: "dwlivetokenlllllllllll", // the end-to-end tests use this one
};

const day = (n) => `2020-01-0${n}`;

function buildViews() {
  const rows = [];
  const pages = [
    ["/", 12],
    ["/about", 6],
    ["/blog", 5],
    ["/blog/dw-article-a", 5],
    ["/blog/dw-article-b", 3],
  ];
  const refs = [
    ["linkedin.com", 14],
    [null, 9],
    ["github.com", 5],
    ["news.example", 3],
  ];
  const perDay = [4, 6, 9, 5, 3, 2, 2];
  const pagePool = pages.flatMap(([p, n]) => Array(n).fill(p));
  const refPool = refs.flatMap(([r, n]) => Array(n).fill(r));
  let i = 0;
  perDay.forEach((n, d) => {
    for (let k = 0; k < n; k++, i++) {
      // day 3 (d = 2) has six visitors for nine views: three of them come back
      const person = d === 2 ? Math.min(k, 5) : k;
      rows.push({
        day: day(d + 1),
        hour: 8 + k,
        path: pagePool[(i * 7) % pagePool.length],
        referrer: refPool[(i * 5) % refPool.length],
        visitor: `dw5eed${String(d + 1).padStart(2, "0")}${String(person).padStart(8, "0")}`,
        device: ["phone", "desktop", "tablet"][i % 3],
      });
    }
  });
  return rows;
}

export const views = buildViews();
export const dropped = [
  ...Array(8).fill(["view", "robot"]),
  ...Array(2).fill(["view", "empty-agent"]),
  ...Array(3).fill(["view", "prefetch"]),
  ...Array(2).fill(["view", "owner"]),
  ...Array(2).fill(["proposal", "prefetch"]),
  ...Array(3).fill(["click", "robot"]),
  ...Array(1).fill(["click", "head"]),
  ...Array(2).fill(["click", "owner"]),
].map(([surface, reason], i) => ({ day: day((i % 7) + 1), surface, reason }));

export const recipients = [
  { key: "ada", name: "DW Ada", created: "2020-01-01 08:00:00+00" },
  { key: "ben", name: "DW Ben", created: "2020-01-02 08:00:00+00" },
  { key: "cy", name: "DW Cy", created: "2020-01-03 08:00:00+00" },
  { key: "live", name: "DW Live", created: "2020-01-04 08:00:00+00" },
];
// visits: [recipient, fetched, opened or null, visible seconds, sections]
export const visits = [
  { who: "ada", key: "dwvisit-ada-1", fetched: "2020-01-02 09:00:00+00", opened: "2020-01-02 09:00:08+00", seconds: 60, sections: ["ask", "fit"] },
  { who: "ada", key: "dwvisit-ada-2", fetched: "2020-01-04 10:00:00+00", opened: "2020-01-04 10:00:06+00", seconds: 25, sections: ["fit", "trade-offs"] },
  { who: "ben", key: "dwvisit-ben-1", fetched: "2020-01-02 11:00:00+00", opened: null, seconds: 0, sections: [] },
];
// reach-outs: [recipient, channel, sent]. Ada has two: the second is sent after both of her opens.
export const reachouts = [
  { who: "ada", channel: "email", sent: "2020-01-02 08:00:00+00" },
  { who: "ada", channel: "linkedin", sent: "2020-01-05 08:00:00+00" },
  { who: "ben", channel: "linkedin", sent: "2020-01-02 07:00:00+00" },
  { who: "cy", channel: "whatsapp", sent: "2020-01-03 09:00:00+00" },
  { who: "ben", channel: "email", sent: "2020-01-06 09:00:00+00" },
];
export const clicks = [
  { who: "ada", slug: "example-project", at: "2020-01-02 09:30:00+00" },
  { who: "ada", slug: "example-article", at: "2020-01-03 09:30:00+00" },
  { who: "ben", slug: "example-project", at: "2020-01-06 12:00:00+00" },
  { who: null, slug: "example-project", at: "2020-01-02 12:00:00+00" },
  { who: null, slug: "example-project", at: "2020-01-03 12:00:00+00" },
  { who: null, slug: "example-article", at: "2020-01-04 12:00:00+00" },
  { who: null, slug: "example-article", at: "2020-01-05 12:00:00+00" },
  { who: null, slug: "example-article", at: "2020-01-06 12:00:00+00" },
];

// ---- expected answers, computed from the rows above
const countBy = (items, key) => {
  const m = new Map();
  for (const x of items) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return m;
};
const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
const days = [1, 2, 3, 4, 5, 6, 7].map(day);

const tsOf = (s) => Date.parse(s.replace(" ", "T").replace("+00", "Z"));

export const expected = {
  viewsPerDay: days.map((d) => views.filter((v) => v.day === d).length),
  visitorsPerDay: days.map((d) => new Set(views.filter((v) => v.day === d).map((v) => v.visitor)).size),
  topPages: top(countBy(views, (v) => v.path)).map(([path, n]) => ({ path, views: n })),
  referrers: top(countBy(views, (v) => v.referrer ?? "direct")).map(([referrer, n]) => ({ referrer, views: n })),
  blogReads: top(countBy(views.filter((v) => v.path.startsWith("/blog/")), (v) => v.path)).map(([path, n]) => ({ path, views: n })),
  droppedCount: dropped.length,
  viewsTotal: views.length,
  clicksWithRecipient: clicks.filter((c) => c.who).length,
  clicksPublic: clicks.filter((c) => !c.who).length,
  recipientCount: recipients.length,
  funnel: (() => {
    const rows = reachouts.map((r) => {
      const sent = tsOf(r.sent);
      return {
        who: r.who,
        opened: visits.some((v) => v.who === r.who && v.opened && tsOf(v.opened) >= sent),
        clicked: clicks.some((c) => c.who === r.who && tsOf(c.at) >= sent),
      };
    });
    return { sent: rows.length, opened: rows.filter((r) => r.opened).length, clicked: rows.filter((r) => r.clicked).length, rows };
  })(),
};

// ---- loading
async function hasTable(db, table) {
  return (await db.query("select to_regclass($1) as t", [`public.${table}`])).rows[0].t !== null;
}

// Removes an earlier load of this seed, so running it twice on one database does not double the rows.
async function clean(db) {
  const gone = async (table, where) => {
    if (await hasTable(db, table)) await db.query(`delete from ${table} where ${where}`);
  };
  await gone("clicks", "at < '2021-01-01'");
  await gone("reachouts", "note = 'dw-seed'");
  await gone("proposal_visits", "visit_key like 'dwvisit-%'");
  await gone("dropped", "at < '2021-01-01'");
  await gone("views", "visitor like 'dw5eed%'");
}

export async function loadDwSeed(db) {
  const loaded = [];
  const skipped = [];
  await clean(db);
  const ts = (d, h) => `${d} ${String(h).padStart(2, "0")}:00:00+00`;
  if (await hasTable(db, "views")) {
    await db.query("delete from views where visitor like 'dw5eed%'");
    for (const v of views) {
      await db.query("insert into views (at, path, referrer_host, visitor, device) values ($1,$2,$3,$4,$5)", [ts(v.day, v.hour), v.path, v.referrer, v.visitor, v.device]);
    }
    loaded.push("views");
  } else skipped.push("views");
  if (await hasTable(db, "dropped")) {
    for (const d of dropped) await db.query("insert into dropped (at, surface, reason) values ($1,$2,$3)", [ts(d.day, 3), d.surface, d.reason]);
    loaded.push("dropped");
  } else skipped.push("dropped");
  if ((await hasTable(db, "proposals")) && (await hasTable(db, "recipients"))) {
    await db.query("insert into proposals (slug, title) values ('demo', 'Demo proposal') on conflict (slug) do nothing");
    const p = (await db.query("select id from proposals where slug = 'demo'")).rows[0].id;
    for (const r of recipients) {
      await db.query("insert into recipients (proposal_id, name, token, created_at) values ($1,$2,$3,$4) on conflict (token) do nothing", [p, r.name, TOKENS[r.key], r.created]);
    }
    loaded.push("proposals", "recipients");
    const idOf = async (key) => (await db.query("select id from recipients where token = $1", [TOKENS[key]])).rows[0].id;
    if (await hasTable(db, "proposal_visits")) {
      for (const v of visits) {
        await db.query(
          "insert into proposal_visits (recipient_id, visit_key, fetched_at, opened_at, visible_seconds, sections_seen) values ($1,$2,$3,$4,$5,$6::text[]) on conflict (visit_key) do nothing",
          [await idOf(v.who), v.key, v.fetched, v.opened, v.seconds, v.sections],
        );
      }
      loaded.push("proposal_visits");
    } else skipped.push("proposal_visits");
    if (await hasTable(db, "reachouts")) {
      for (const r of reachouts) await db.query("insert into reachouts (sent_at, recipient_id, channel, note) values ($1,$2,$3,'dw-seed')", [r.sent, await idOf(r.who), r.channel]);
      loaded.push("reachouts");
    } else skipped.push("reachouts");
    if (await hasTable(db, "clicks")) {
      for (const c of clicks) await db.query("insert into clicks (at, slug, recipient_id) values ($1,$2,$3)", [c.at, c.slug, c.who ? await idOf(c.who) : null]);
      loaded.push("clicks");
    } else skipped.push("clicks");
  } else skipped.push("proposals", "recipients", "proposal_visits", "reachouts", "clicks");
  return { loaded, skipped };
}
