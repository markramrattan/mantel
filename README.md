# Mantel

Mantel is an Echo Show frame for a Solana wallet. The screen is a browser simulator, so you can try it without an Alexa device, an Alexa+ account, or a seed phrase.

The page is a real MCP client. It talks to a self-hosted MCP server over Streamable HTTP using protocol `2025-11-25`. The server reads collectibles from the public [Magic Eden](https://magiceden.io) Solana API. No API key.

## Try it

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

1. Click **Preview a public wallet**, or paste any Solana address and choose **Show collection**.
2. Use the bar at the bottom as if you were talking to Alexa. Type `slideshow`, `only Mad Lads`, `next`, or `tell me about this`.
3. Click **Mic** in Chrome or Edge if you want to speak instead of type. **Mute** turns off the spoken reply.

That is the whole test. The hackathon does not give entrants access to a real Alexa+ device, and a web simulator that calls your MCP server is an accepted Alexa+ submission.

Arrow keys move between pieces when the cursor is not in a text field.

## What the server exposes

| Tool | What it does |
| --- | --- |
| `list_collectibles` | Reads up to 40 collectibles for a public wallet. Optional `collection` filter. |
| `get_collectible` | Reads one mint and returns a short spoken description. |

Both tools are read-only. Mantel never asks for a private key.

Data is attributed to Magic Eden, whose public API terms ask apps to credit them.

## Production mode

```bash
npm run build
npm start
```

The MCP server and the built screen are both served on [http://127.0.0.1:8787](http://127.0.0.1:8787).
