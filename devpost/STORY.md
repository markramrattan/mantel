## Inspiration

Collectibles on Solana already have a home in a wallet. They do not have a home in the room. An Echo Show sits on a shelf and already rotates photos. Mantel treats that screen as a frame: the wallet is the gallery, and the display never has to hold a key.

## What it does

Mantel shows the collectibles in a Solana wallet on an Echo Show-style display. You paste a public address, or preview a known public wallet. The screen loads the pieces, lets you filter to a collection, open one, and run a slideshow.

The bar along the bottom is the Alexa stand-in. Type or say “show my collection”, “only Mad Lads”, “slideshow”, “next”, or “tell me about this”. The reply is written on the screen and can be spoken aloud by the laptop.

## How I built it

The display is a web app, and it is a real MCP client. On load it sends `initialize` with protocol version `2025-11-25`, then `notifications/initialized`, then `tools/call` over Streamable HTTP. The MCP server is self-hosted with the official TypeScript SDK.

Two tools do the work. `list_collectibles` reads a public wallet. `get_collectible` reads one mint and turns the traits into a sentence. Both call the public Magic Eden Solana API (`api-mainnet.magiceden.dev/v2`). That API needs no key and no signature, which is the right fit for a frame: looking at what a wallet holds is not a transaction.

I tested it in a browser on purpose. Alexa+ add-on consoles are partner-only for this hackathon, so there is no way to attach this server to a physical Echo Show yet. The rules accept a simulated Alexa+ experience when the demo shows it working, and this simulator performs the actual MCP handshake.

## Challenges

A smart display has no wallet extension and no good way to type a seed phrase. That constraint was useful. Mantel only accepts a public address, and the copy on the screen says so.

The public wallet endpoint returns a page of items, not a guaranteed full inventory, and it is rate limited. The server caches a wallet for a minute and asks for at most 40 pieces. Collection filters apply to that page.

Some piece images are hosted on Arweave or IPFS and load slowly. The frame keeps the name and collection on the card so a missing image does not blank the wall.

## What I learned

The interesting part of an Alexa+ submission, without device access, is making the protocol visible. The screen shows the tool it just called (`list_collectibles` or `get_collectible`) so a demo can prove the client is not a fake dataset. A living-room frame is also a better Solana interface than a marketplace grid: big type, one piece at a time, and a sentence you can hear from across the room.

## What's next

When Alexa+ add-on access is public, this same MCP server is what the device would call. The next step is account linking for a paired phone, so the display can follow a wallet without pasting an address, still without ever seeing a key.
