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

export type ToolPayload = {
  speech: string;
  owner?: string;
  items?: Collectible[];
  item?: Collectible;
  collections?: string[];
};
