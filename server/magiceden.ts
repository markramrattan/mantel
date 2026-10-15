const API = "https://api-mainnet.magiceden.dev/v2";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type Collectible = {
  mint: string;
  name: string;
  image: string;
  collection: string;
  collectionName: string;
  attributes: { trait_type: string; value: string }[];
  listStatus: string;
  externalUrl: string;
  magicEdenUrl: string;
};

type RawToken = {
  mintAddress?: string;
  name?: string;
  image?: string;
  collection?: string;
  collectionName?: string;
  attributes?: { trait_type?: string; value?: string }[];
  listStatus?: string;
  externalUrl?: string;
};

const cache = new Map<string, { at: number; items: Collectible[] }>();
const TTL_MS = 60_000;

export function assertWallet(owner: string): string {
  const trimmed = owner.trim();
  if (!BASE58.test(trimmed)) {
    throw new Error("That is not a Solana wallet address. Paste the public address only. Mantel never accepts a seed phrase.");
  }
  return trimmed;
}

function normalize(raw: RawToken): Collectible | null {
  if (!raw.mintAddress) return null;
  const attributes = (raw.attributes ?? [])
    .filter((entry) => entry.trait_type && entry.value)
    .slice(0, 12)
    .map((entry) => ({ trait_type: String(entry.trait_type), value: String(entry.value) }));
  return {
    mint: raw.mintAddress,
    name: raw.name?.trim() || "Untitled",
    image: raw.image?.trim() || "",
    collection: raw.collection?.trim() || "",
    collectionName: raw.collectionName?.trim() || raw.collection?.trim() || "Uncategorized",
    attributes,
    listStatus: raw.listStatus || "unknown",
    externalUrl: raw.externalUrl?.trim() || "",
    magicEdenUrl: `https://magiceden.io/item-details/${raw.mintAddress}`,
  };
}

async function fetchPage(owner: string, offset: number, limit: number): Promise<Collectible[]> {
  const url = `${API}/wallets/${encodeURIComponent(owner)}/tokens?offset=${offset}&limit=${limit}&listStatus=both`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mantel/1.0 (Echo Show simulator; public read)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status === 429) {
    throw new Error("Magic Eden is rate limiting requests. Wait a moment and try again.");
  }
  if (!response.ok) {
    throw new Error(`Magic Eden returned ${response.status} for that wallet.`);
  }
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) {
    throw new Error("Magic Eden returned an unexpected payload.");
  }
  return body.map((entry) => normalize(entry as RawToken)).filter((item): item is Collectible => item !== null);
}

export async function listCollectibles(owner: string): Promise<Collectible[]> {
  const wallet = assertWallet(owner);
  const hit = cache.get(wallet);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.items;
  const items = await fetchPage(wallet, 0, 40);
  cache.set(wallet, { at: Date.now(), items });
  return items;
}

export function filterCollectibles(items: Collectible[], collection: string | undefined, limit: number): Collectible[] {
  const parts = (collection ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const matched = parts.length
    ? items.filter((item) => {
        const haystack = `${item.collectionName} ${item.collection} ${item.name}`.toLowerCase();
        return parts.some((part) => haystack.includes(part));
      })
    : items;
  return matched.slice(0, limit);
}

export async function getCollectible(mint: string): Promise<Collectible> {
  const id = mint.trim();
  if (!BASE58.test(id)) throw new Error("That mint address is not valid.");
  const response = await fetch(`${API}/tokens/${encodeURIComponent(id)}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mantel/1.0 (Echo Show simulator; public read)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Magic Eden could not find mint ${id}.`);
  const body = (await response.json()) as RawToken;
  const item = normalize(body);
  if (!item) throw new Error("That token has no mint address.");
  return item;
}

export function describeCollectible(item: Collectible): string {
  const collection = item.collectionName || "an uncategorized collection";
  const traits = item.attributes
    .filter((trait) => !/count/i.test(trait.trait_type))
    .slice(0, 3)
    .map((trait) => `${trait.value} ${trait.trait_type.toLowerCase()}`);
  if (traits.length === 0) return `${item.name}, from ${collection}.`;
  if (traits.length === 1) return `${item.name}, from ${collection}. It has ${traits[0]}.`;
  const last = traits[traits.length - 1];
  return `${item.name}, from ${collection}. It has ${traits.slice(0, -1).join(", ")}, and ${last}.`;
}
