// Ajoute une image (og:image) aux sujets qui n'en ont pas, à partir des articles cités en sources.
// Lancé par .github/workflows/images.yml après chaque publication de editions.json.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'editions.json';
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const MAX_BYTES = 5 * 1024 * 1024;
// Jamais d'image venant d'un parti, d'un réseau social ou d'une source non journalistique.
const BLOCKED = [
  'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be',
  'linkedin.com', 'bsky.app', 'threads.net', 'telegram.me', 't.me',
  'rassemblementnational.fr', 'lafranceinsoumise.fr', 'parti-socialiste.fr', 'lesecologistes.fr',
  'parti-renaissance.fr', 'mouvementdemocrate.fr', 'horizonsleparti.fr', 'republicains.fr',
  'reconquete.fr', 'lutte-ouvriere.org', 'npa-lanticapitaliste.org', 'revolutionpermanente.fr',
  'pcf.fr', 'placepublique.eu', 'udr.fr',
  'assemblee-nationale.fr', 'senat.fr', 'elysee.fr', 'gouvernement.fr', 'diplomatie.gouv.fr',
  'nosparlementaires.fr', 'wikipedia.org', 'news.google.com', 'titrespresse.com',
];

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

const blocked = (u) => {
  try { const h = new URL(u).hostname.replace(/^www\./, ''); return BLOCKED.some((b) => h === b || h.endsWith('.' + b)); }
  catch { return true; }
};

async function get(url, opts = {}) {
  return fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': UA, 'Accept-Language': 'fr-FR,fr;q=0.9' }, ...opts });
}

function meta(html, names) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const name of names) {
    for (const t of tags) {
      const key = t.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
      if (!key || key[1].toLowerCase() !== name) continue;
      const c = t.match(/\bcontent\s*=\s*"([^"]*)"/i) || t.match(/\bcontent\s*=\s*'([^']*)'/i);
      if (c && c[1].trim()) return decode(c[1].trim());
    }
  }
  return null;
}

async function checkImage(u) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await get(u, { method, headers: { 'User-Agent': UA, ...(method === 'GET' ? { Range: 'bytes=0-1023' } : {}) } });
      if (method === 'GET') r.body?.cancel().catch(() => {});
      if (!(r.status === 200 || (method === 'GET' && r.status === 206))) continue;
      if (!r.url.startsWith('https://')) return false;
      const type = r.headers.get('content-type') || '';
      if (!type.toLowerCase().startsWith('image/')) continue;
      const len = method === 'HEAD' ? +(r.headers.get('content-length') || 0) : +((r.headers.get('content-range') || '').split('/')[1] || 0);
      if (len && len >= MAX_BYTES) return false;
      return true;
    } catch { /* on tente la méthode suivante */ }
  }
  return false;
}

async function imageFor(story) {
  for (const src of story.sources || []) {
    if (!src.u?.startsWith('https://') || blocked(src.u)) continue;
    try {
      const r = await get(src.u);
      if (!r.ok) { console.log(`  ${r.status} ${src.u}`); continue; }
      const html = (await r.text()).slice(0, 400000);
      let img = meta(html, ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);
      if (!img) { console.log(`  pas d'og:image ${src.u}`); continue; }
      img = new URL(img, r.url).href.replace(/^http:\/\//, 'https://');
      if (blocked(img) || !(await checkImage(img))) { console.log(`  image refusée ${img}`); continue; }
      const credit = (src.t || '').split(/\s[–—-]\s/)[0].trim() || new URL(src.u).hostname.replace(/^www\./, '');
      const alt = meta(html, ['og:image:alt', 'twitter:image:alt']) || `Illustration de l'article de ${credit}`;
      return { u: img, credit, alt: alt.slice(0, 300) };
    } catch (e) { console.log(`  erreur ${src.u} : ${e.message}`); }
  }
  return null;
}

const data = JSON.parse(readFileSync(FILE, 'utf8'));
let added = 0, missing = 0;
for (const ed of data.editions) {
  for (const s of ed.stories || []) {
    // Uniquement les éditions au nouveau format (dix courants) : les anciennes restent telles quelles.
    if (s.image || !s.positions || !('eg' in s.positions)) continue;
    console.log(`${s.id}`);
    const img = await imageFor(s);
    if (img) { s.image = img; added++; console.log(`  -> ${img.u} (${img.credit})`); }
    else { missing++; console.log('  -> aucune image fiable'); }
  }
}
if (added) writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log(`Images ajoutées : ${added}, sans image : ${missing}`);
