// Tevel IntelliDB — business vocabulary.
// Expands cryptic DB naming (tbl_cust_hdr -> "customer header") so both the ranker
// and the LLM understand intent. Users can extend/override via custom aliases.

/** Common enterprise-DB abbreviations. Extend via user vocabulary at call sites. */
export const DEFAULT_ABBREVIATIONS: Record<string, string> = {
   cust: 'customer',
   custs: 'customers',
   clnt: 'client',
   inv: 'invoice',
   invc: 'invoice',
   bill: 'invoice',
   ord: 'order',
   ordr: 'order',
   so: 'sales order',
   po: 'purchase order',
   pmt: 'payment',
   pay: 'payment',
   pymt: 'payment',
   prod: 'product',
   prd: 'product',
   itm: 'item',
   sku: 'product',
   qty: 'quantity',
   amt: 'amount',
   bal: 'balance',
   tot: 'total',
   addr: 'address',
   dept: 'department',
   emp: 'employee',
   empl: 'employee',
   usr: 'user',
   acct: 'account',
   org: 'organization',
   loc: 'location',
   cat: 'category',
   desc: 'description',
   ref: 'reference',
   txn: 'transaction',
   trx: 'transaction',
   hdr: 'header',
   dtl: 'detail',
   det: 'detail',
   mst: 'master',
   mstr: 'master',
   mstd: 'master data',
   cfg: 'config',
   whse: 'warehouse',
   wh: 'warehouse',
   shp: 'shipment',
   dlvr: 'delivery',
   num: 'number',
   no: 'number',
   dt: 'date',
   dte: 'date',
   ts: 'timestamp',
   fk: '',
   pk: '',
   id: 'id'
};

// Prefixes/suffixes that carry no business meaning.
const NOISE = new Set(['tbl', 'tb', 't', 'vw', 'v', 'sp', 'fn', 'dim', 'fact', 'stg', 'tmp']);

/** Split an identifier into lowercase word parts (snake_case + camelCase). */
export function splitIdentifier (name: string): string[] {
   return name
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .split(/[_\-\s.]+/)
      .map(p => p.toLowerCase())
      .filter(Boolean);
}

/** Expand a single token via custom aliases first, then defaults; unknown tokens pass through. */
export function expandToken (token: string, custom: Record<string, string> = {}): string {
   const key = token.toLowerCase();
   if (key in custom) return custom[key];
   if (key in DEFAULT_ABBREVIATIONS) return DEFAULT_ABBREVIATIONS[key];
   return token;
}

/**
 * Turn an identifier into a human phrase.
 * "tbl_cust_hdr" -> "customer header"; "invMst" -> "invoice master".
 */
export function humanizeName (name: string, custom: Record<string, string> = {}): string {
   return splitIdentifier(name)
      .filter(p => !NOISE.has(p))
      .map(p => expandToken(p, custom))
      .filter(Boolean)
      .join(' ')
      .trim();
}

/** All lowercase search terms for an identifier: original parts + expansions. */
export function expandTerms (name: string, custom: Record<string, string> = {}): Set<string> {
   const terms = new Set<string>();
   for (const part of splitIdentifier(name)) {
      terms.add(part);
      const expanded = expandToken(part, custom);
      for (const w of expanded.split(' ')) if (w) terms.add(w.toLowerCase());
   }
   return terms;
}
