import { parseFeed, pickCandidates, normalizeUrl, hostOf, SOURCES } from './lib/discover.ts';

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log('  ok  ', name); }
  else { fail++; console.log('  FAIL', name, detail && '\n        ' + detail); }
};

/* A WordPress feed, which is what most food blogs serve. */
const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Budget Bytes</title>
  <link>https://www.budgetbytes.com</link>
  <item>
    <title><![CDATA[Creamy Garlic &amp; Herb Pasta]]></title>
    <link>https://www.budgetbytes.com/creamy-garlic-herb-pasta/</link>
    <guid isPermaLink="false">https://www.budgetbytes.com/?p=12345</guid>
  </item>
  <item>
    <title>Sheet Pan Gnocchi &#8217;n Veg</title>
    <link>https://www.budgetbytes.com/sheet-pan-gnocchi/?utm_source=rss&amp;utm_medium=feed</link>
  </item>
</channel></rss>`;

/* An Atom feed, where the link is an attribute and several rels appear. */
const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title type="html">Marry Me Chickpeas</title>
    <link rel="edit" href="https://example.com/edit/1"/>
    <link rel="alternate" type="text/html" href="https://example.com/marry-me-chickpeas"/>
  </entry>
  <entry>
    <title>Not A Recipe</title>
    <link href="https://example.com/notes/hello"/>
  </entry>
</feed>`;

console.log('\n════════ feed parsing ════════\n');
{
  const items = parseFeed(RSS);
  check('reads both RSS items', items.length === 2, `got ${items.length}`);
  check('unwraps CDATA and entities', items[0].title === 'Creamy Garlic & Herb Pasta', items[0].title);
  check('decodes a curly apostrophe', items[1].title.includes('’'), items[1].title);
  check('prefers link over guid', items[0].link === 'https://www.budgetbytes.com/creamy-garlic-herb-pasta/', items[0].link);
}
{
  const items = parseFeed(ATOM);
  check('reads both Atom entries', items.length === 2, `got ${items.length}`);
  check('takes rel=alternate, not rel=edit', items[0].link === 'https://example.com/marry-me-chickpeas', items[0].link);
  check('falls back to the only href', items[1].link === 'https://example.com/notes/hello', items[1].link);
}
{
  check('an empty feed is empty, not a crash', parseFeed('<rss><channel></channel></rss>').length === 0);
  check('junk is empty, not a crash', parseFeed('not xml at all').length === 0);
  check('drops a relative link', parseFeed('<rss><item><title>x</title><link>/relative</link></item></rss>').length === 0);
}

console.log('\n════════ same recipe, different URL ════════\n');
{
  const a = 'https://www.budgetbytes.com/sheet-pan-gnocchi/?utm_source=rss&utm_medium=feed';
  const b = 'https://www.budgetbytes.com/sheet-pan-gnocchi';
  check('tracking and trailing slash are ignored', normalizeUrl(a) === normalizeUrl(b), `${normalizeUrl(a)} vs ${normalizeUrl(b)}`);
  check('a fragment is ignored', normalizeUrl('https://x.com/a#recipe') === normalizeUrl('https://x.com/a'));
  check('different paths stay different', normalizeUrl('https://x.com/a') !== normalizeUrl('https://x.com/b'));
  check('host is readable', hostOf('https://www.loveandlemons.com/x/') === 'loveandlemons.com', hostOf('https://www.loveandlemons.com/x/'));
}

console.log('\n════════ choosing candidates ════════\n');
{
  const mk = (host: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ title: `${host} ${i}`, link: `https://${host}.com/r${i}` }));

  const picked = pickCandidates([mk('alpha', 5), mk('beta', 5)], [], 4);
  check('takes the number asked for', picked.length === 4, `got ${picked.length}`);
  check(
    'interleaves so one blog cannot fill the list',
    new Set(picked.map((p) => hostOf(p.link))).size === 2,
    picked.map((p) => p.link).join(' ')
  );

  const already = ['https://alpha.com/r0/', 'https://alpha.com/r1?utm=x'];
  const fresh = pickCandidates([mk('alpha', 5)], already, 5);
  check('skips what the library already has', !fresh.some((f) => /r0|r1/.test(f.link)), fresh.map((f) => f.link).join(' '));
  check('and still returns the rest', fresh.length === 3, `got ${fresh.length}`);

  const dupes = pickCandidates([mk('alpha', 2), mk('alpha', 2)], [], 10);
  check('never offers the same link twice', dupes.length === 2, dupes.map((d) => d.link).join(' '));

  const rotated = pickCandidates([mk('alpha', 4)], [], 2, 2);
  check('an offset rotates the starting point', rotated[0].link === 'https://alpha.com/r2', rotated[0]?.link);

  check('asking for more than exists is fine', pickCandidates([mk('alpha', 2)], [], 99).length === 2);
  check('no sources is empty, not a crash', pickCandidates([], [], 5).length === 0);
}

console.log('\n════════ the source list ════════\n');
{
  check('every source has a feed url', SOURCES.every((s) => /^https:\/\//.test(s.feed)));
  check('ids are unique', new Set(SOURCES.map((s) => s.id)).size === SOURCES.length);
  check('some are on by default', SOURCES.filter((s) => s.standard).length >= 2);
  check(
    'no Dotdash Meredith site, which 403s non-browsers',
    !SOURCES.some((s) => /allrecipes|seriouseats|simplyrecipes/.test(s.feed)),
  );
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
