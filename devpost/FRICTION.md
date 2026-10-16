# Mantel friction log

Amazon Developer Hackathon 2026. Primary track: Alexa+.

## 1. No way to attach a hackathon MCP server to Alexa+

- **Task:** Demo Mantel on Alexa+ or an official Echo Show simulator.
- **Steps:** Read the hackathon Alexa+ rules and the Alexa+ MCP quickstart. Looked for a way to register a self-hosted Streamable HTTP server.
- **Expected:** A console or simulator where the server could be linked and called from a device.
- **Actual:** The add-on developer tools, including the MCP Toolkit, CLI, and Web Simulator, are partner-only. Hackathon participants cannot request access.
- **Severity:** High.
- **Workaround:** Built a browser Echo Show that is a real MCP client. It sends `initialize` with `protocolVersion` `2025-11-25`, then `notifications/initialized`, then `tools/call`.
- **Suggestion:** Publish a hackathon sandbox that accepts an MCP URL and shows the tool call on an Echo Show frame.

## 2. MCP SDK does not default to the required protocol version

- **Task:** Negotiate MCP protocol `2025-11-25` with `@modelcontextprotocol/sdk` 1.32.1.
- **Steps:** Stood up `StreamableHTTPServerTransport` and sent `initialize` from the browser client.
- **Expected:** The current SDK would negotiate the current spec by default.
- **Actual:** The SDK’s default negotiated version is `2025-03-26` unless the client explicitly requests `2025-11-25`. A stateless server also rejects `tools/call`, because each HTTP request is a new session that has not been initialized.
- **Severity:** Medium.
- **Workaround:** The client sends `protocolVersion` `2025-11-25`, stores the `Mcp-Session-Id` header, and reuses that stateful session. The server uses `enableJsonResponse` so the browser can read a normal JSON body.
- **Suggestion:** Ship a minimal stateful Streamable HTTP example that requests `2025-11-25`, aimed at Alexa+ add-ons.

## 3. Public wallet page is partial, and images arrive late

- **Task:** Load a wallet’s collectibles from the public Magic Eden API, `GET /v2/wallets/{address}/tokens`.
- **Steps:** Requested the first page with `limit` 40 and rendered image, name, and collection on the frame.
- **Expected:** A stable page of the wallet, with images that appear with the cards.
- **Actual:** The first page is capped and its order changes between calls, so the same preview wallet showed a different count on different days. Image hosts (Arweave, S3, and collection CDNs) often finish after the card is drawn, so the frame briefly shows an empty tile. The API needs no key, which is what made the demo possible.
- **Severity:** Medium.
- **Workaround:** Cache each wallet for 60 seconds, keep the name and collection on the card, and attribute Magic Eden on the screen.
- **Suggestion:** Return paging totals by default, and a hotlink-stable image URL for each token, so a display can render a wallet in one pass.
