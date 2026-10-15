import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  describeCollectible,
  filterCollectibles,
  getCollectible,
  listCollectibles,
} from "./magiceden.js";

function toolText(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

function toolError(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createMantelServer(): McpServer {
  const server = new McpServer(
    { name: "mantel", version: "1.0.0" },
    {
      instructions:
        "Mantel is a read-only Echo Show frame for a Solana wallet. Use list_collectibles to load what a public address owns, and get_collectible to describe one piece. Never ask for a seed phrase, private key, or signature.",
    },
  );

  server.registerTool(
    "list_collectibles",
    {
      title: "List collectibles",
      description:
        "Read Solana collectibles for a public wallet address from the Magic Eden public API. Optionally filter by collection name or symbol. Read-only.",
      inputSchema: {
        owner: z.string().describe("Solana wallet address. Public key only."),
        collection: z
          .string()
          .optional()
          .describe("Collection name, symbol, or a comma-separated list. Omit to return the wallet page."),
        limit: z.number().int().min(1).max(40).optional().describe("Maximum items to return. Default 24."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ owner, collection, limit }) => {
      try {
        const owned = await listCollectibles(owner);
        const items = filterCollectibles(owned, collection, limit ?? 24);
        const names = [...new Set(owned.map((item) => item.collectionName))].slice(0, 8);
        const speech = items.length
          ? collection
            ? `I found ${items.length} ${items.length === 1 ? "piece" : "pieces"} matching ${collection}.`
            : `I found ${items.length} ${items.length === 1 ? "piece" : "pieces"} in this wallet.`
          : owned.length
            ? `Nothing in this wallet matched ${collection}. I can see ${names.join(", ")}.`
            : "That wallet has no collectibles on the public Magic Eden index.";
        return toolText({ speech, owner: owner.trim(), items, collections: names });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Could not read that wallet.");
      }
    },
  );

  server.registerTool(
    "get_collectible",
    {
      title: "Get collectible",
      description: "Read one Solana collectible by mint address and return a short spoken description.",
      inputSchema: {
        mint: z.string().describe("Solana mint address of the collectible."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ mint }) => {
      try {
        const item = await getCollectible(mint);
        return toolText({ speech: describeCollectible(item), item });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Could not read that collectible.");
      }
    },
  );

  return server;
}
