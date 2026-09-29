/**
 * Menus on the Yalla QR Codes platform (`<restaurant>.yallaqrcodes.com`).
 *
 * The page lists an item that has SIZES without any price — `شاي أحمر` shows
 * nothing, because كوب 4 / إبريق صغير 15 / إبريق كبير 20 only appear when the
 * item is opened. A page-text scrape (Jina) therefore cannot see them, and the
 * model dropped 17 such items on 2026-09-29. The platform serves the same data
 * as public JSON, which its own page reads:
 *
 *   GET /api/categories/        the sections
 *   GET /api/items-light/       every item, base price only
 *   GET /api/items/<id>/        one item WITH its `modifiers` (options)
 *
 * all with a `branch: <n>` header taken from `/branch/<n>/` in the page URL. The
 * server's CORS policy allows that header from any origin (checked 2026-09-29).
 *
 * This module turns that JSON into plain text for the model, one line per
 * variant with its real price. Pure except `fetchYallaMenu`, which takes the
 * fetch function as a parameter so it can be tested without a network.
 */

export interface YallaSource {
  /** e.g. `https://kelah.yallaqrcodes.com` */
  origin: string;
  /** From `/branch/<n>/`; the header is omitted when the URL has none. */
  branch?: string;
}

/** The platform's JSON for this URL, or null when the URL is not on it. */
export const yallaMenuSource = (pageUrl: string): YallaSource | null => {
  let u: URL;
  try { u = new URL(pageUrl); } catch { return null; }
  if (u.protocol !== 'https:' || !/^[a-z0-9-]+\.yallaqrcodes\.com$/i.test(u.hostname)) return null;
  const branch = /\/branch\/(\d+)(?:\/|$)/.exec(u.pathname)?.[1];
  return { origin: u.origin, ...(branch ? { branch } : {}) };
};

export interface YallaOption { name_ar?: string; name_en?: string; price?: number; available?: boolean; is_deleted?: boolean }
export interface YallaModifier { name_ar?: string; name_en?: string; name?: string; min_options?: number | null; max_options?: number | null; is_deleted?: boolean; options?: YallaOption[] }
export interface YallaItem {
  id: number; category: number; price?: number; available?: boolean; is_deleted?: boolean; sort_order?: number;
  name_ar?: string; name_en?: string; description_ar?: string; description_en?: string; image_full?: string | null; image?: string | null;
}
export interface YallaCategory { id: number; name_ar?: string; name_en?: string; sort_order?: number; is_deleted?: boolean }
export interface YallaDetail { modifiers?: YallaModifier[] }

const name = (o: { name_ar?: string; name_en?: string; name?: string }) =>
  (o.name_ar || o.name_en || o.name || '').trim();
const money = (n: number) => n.toFixed(2);
const live = <T extends { is_deleted?: boolean }>(xs: readonly T[] | undefined) => (xs ?? []).filter((x) => !x.is_deleted);

/**
 * `شاي أحمر - الحجم` → `الحجم`. The platform prefixes each modifier with the
 * item's own name; the option dimension is the part after it.
 */
const dimension = (mod: YallaModifier, itemName: string): string => {
  const full = name(mod);
  for (const sep of [' - ', ' – ', ' — ']) {
    const i = full.lastIndexOf(sep);
    if (i > 0) return full.slice(i + sep.length).trim() || full;
  }
  return full.startsWith(itemName) ? full.slice(itemName.length).trim() || full : full;
};

/**
 * A REQUIRED choice (`min_options >= 1`) makes variants: the customer must pick
 * one, so each option is its own sellable row. An optional modifier is an
 * add-on and stays on the item as text.
 */
const isVariantModifier = (m: YallaModifier) => (m.min_options ?? 0) >= 1 && live(m.options).length > 0;

/**
 * A variant's price. Option prices on this platform are the FULL price, not a
 * surcharge: `ديناميت دجاج` lists 22 and its sizes are صغير 18 / كبير 22. A
 * choice that costs nothing extra (`حار` / `بارد` at 0) keeps the item's price.
 */
const variantPrice = (opt: YallaOption, base: number) => ((opt.price ?? 0) > 0 ? opt.price! : base);

const NO_PRICE = '(no price listed on the menu)';
/** `4.00`, or the no-price marker — never `0.00` for a price the menu does not give. */
const priceText = (n: number) => (n > 0 ? money(n) : NO_PRICE);

export interface YallaMenuStats { items: number; withVariants: number; variantRows: number; noPrice: number }

/**
 * The menu as text for the model. Items without options are one line; an item
 * with a required choice becomes one `VARIANT` line per option. Items that have
 * no price anywhere are marked as such rather than guessed.
 */
export function yallaMenuText(
  categories: readonly YallaCategory[],
  items: readonly YallaItem[],
  details: ReadonlyMap<number, YallaDetail>,
  pageUrl = '',
): { text: string; stats: YallaMenuStats } {
  const stats: YallaMenuStats = { items: 0, withVariants: 0, variantRows: 0, noPrice: 0 };
  const byCat = new Map<number, YallaItem[]>();
  for (const it of live(items)) {
    if (it.available === false) continue;
    const list = byCat.get(it.category);
    if (list) list.push(it); else byCat.set(it.category, [it]);
  }
  const lines: string[] = [
    `Menu data from ${pageUrl || 'a Yalla QR Codes menu'} (read from the menu's own data, not the page text).`,
    'Each line is one sellable row. A VARIANT line is one option of a product that must be chosen when ordering; give it its own row with Option 1 = the option name and Option 1 Value = the value.',
    '',
  ];
  const cats: YallaCategory[] = [...live(categories)].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  // Items whose section is not in the section list are kept, under their own
  // heading at the end, rather than silently dropped.
  const known = new Set(cats.map((c) => c.id));
  const orphans = [...byCat.keys()].filter((id) => !known.has(id));
  for (const id of orphans) cats.push({ id, name_ar: '(no section)', sort_order: Number.MAX_SAFE_INTEGER });
  for (const cat of cats) {
    const its = (byCat.get(cat.id) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (its.length === 0) continue;
    lines.push(`## ${name(cat)}`);
    for (const it of its) {
      stats.items++;
      const n = name(it);
      const base = it.price ?? 0;
      const desc = (it.description_ar || it.description_en || '').replace(/\s+/g, ' ').trim();
      const photo = it.image_full || it.image || '';
      const tail = `${desc ? ` | Description: ${desc}` : ''}${photo ? ` | Photo: ${photo}` : ''}`;
      const mods = live(details.get(it.id)?.modifiers);
      const variantMods = mods.filter(isVariantModifier);
      const addOns = mods.filter((m) => !isVariantModifier(m) && live(m.options).length > 0);
      const addOnText = addOns.length
        ? ` | Add-ons (optional, not separate rows): ${addOns.map((m) => `${dimension(m, n)}: ${live(m.options).map((o) => `${name(o)} +${money(o.price ?? 0)}`).join(', ')}`).join('; ')}`
        : '';
      // The first required choice is the variant dimension. Any further
      // required choice is listed on each row rather than multiplied out: the
      // platform gives no combined price, and inventing one would be a guess.
      const [dim, ...others] = variantMods;
      const choices = dim ? live(dim.options).filter((o) => o.available !== false) : [];
      // No usable choice (none required, or every option unavailable): the item
      // is one plain row, so it never disappears from the output.
      if (choices.length === 0) {
        if (base <= 0) stats.noPrice++;
        lines.push(`- ${n} | Price: ${priceText(base)}${tail}${addOnText}`);
        continue;
      }
      stats.withVariants++;
      const otherText = others.length
        ? ` | Also required: ${others.map((m) => `${dimension(m, n)} (${live(m.options).map(name).join(' / ')})`).join('; ')}`
        : '';
      let unpriced = false;
      for (const opt of choices) {
        stats.variantRows++;
        const price = variantPrice(opt, base);
        if (price <= 0) unpriced = true;
        lines.push(`- VARIANT ${n} | Option 1: ${dimension(dim, n)} | Option 1 Value: ${name(opt)} | Price: ${priceText(price)}${tail}${otherText}${addOnText}`);
      }
      if (unpriced) stats.noPrice++;
    }
    lines.push('');
  }
  return { text: lines.join('\n').trim(), stats };
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Read the whole menu. Item details are fetched a few at a time — every item,
 * because the light listing's `options_count` is 0 even for items that have
 * options. A detail that fails leaves that item without variants (counted in
 * `failedDetails`) rather than failing the scrape.
 */
export async function fetchYallaMenu(src: YallaSource, pageUrl: string, fetchFn: FetchLike, concurrency = 6) {
  const headers: Record<string, string> = { accept: 'application/json', ...(src.branch ? { branch: src.branch } : {}) };
  const get = async (path: string) => {
    const res = await fetchFn(`${src.origin}${path}`, { headers });
    if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`);
    const body = (await res.json()) as { data?: unknown };
    return body?.data;
  };
  const [categories, items] = await Promise.all([get('/api/categories/'), get('/api/items-light/')]);
  if (!Array.isArray(categories) || !Array.isArray(items) || items.length === 0) throw new Error('menu data has no items');
  const details = new Map<number, YallaDetail>();
  let failedDetails = 0;
  const queue = (items as YallaItem[]).filter((i) => !i.is_deleted).map((i) => i.id);
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try { details.set(id, ((await get(`/api/items/${id}/`)) ?? {}) as YallaDetail); } catch { failedDetails++; }
    }
  }));
  const { text, stats } = yallaMenuText(categories as YallaCategory[], items as YallaItem[], details, pageUrl);
  return { text, stats, failedDetails };
}
