export type Intent =
  | { type: "list"; owner: string; collection?: string }
  | { type: "detail" }
  | { type: "slideshow" }
  | { type: "gallery" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "home" }
  | { type: "need_wallet" }
  | { type: "unknown"; speech: string };

const ADDRESS = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

type Context = {
  owner?: string;
  hasFocus: boolean;
};

export function interpret(raw: string, ctx: Context): Intent {
  const text = raw.trim();
  const lower = text.toLowerCase().replace(/[.?!]+$/g, "").trim();
  if (!lower) return { type: "unknown", speech: "Say, show my collection." };

  const address = text.match(ADDRESS)?.[0];
  if (address && address.length >= 32) return { type: "list", owner: address };

  if (/^(home|start over|clear)$/.test(lower)) return { type: "home" };
  if (/^(next|skip|go forward)$/.test(lower)) return { type: "next" };
  if (/^(previous|prev|go back)$/.test(lower)) return { type: "prev" };
  if (/^(slideshow|frame|play|start slideshow)$/.test(lower)) return { type: "slideshow" };
  if (/^(gallery|grid)$/.test(lower)) return { type: "gallery" };

  if (/^(everything|entire wallet|whole wallet|show everything|show all|show the whole wallet)$/.test(lower)) {
    return ctx.owner ? { type: "list", owner: ctx.owner } : { type: "need_wallet" };
  }

  if (/^(tell me about this|tell me about this one|about this|describe this|what is this|what's this|more)$/.test(lower)) {
    return ctx.hasFocus ? { type: "detail" } : { type: "unknown", speech: "Open a piece first, then ask me about it." };
  }

  if (/^(show )?(my )?(collection|items|art|wallet)$/.test(lower) || lower === "show my collection") {
    return ctx.owner ? { type: "list", owner: ctx.owner } : { type: "need_wallet" };
  }

  const filtered = lower.match(/^(?:only|filter|just|show me|show)\s+(.+)$/);
  if (filtered) {
    const rest = filtered[1].trim();
    if (/^(my )?(collection|items|art|wallet)$/.test(rest)) {
      return ctx.owner ? { type: "list", owner: ctx.owner } : { type: "need_wallet" };
    }
    return ctx.owner ? { type: "list", owner: ctx.owner, collection: rest } : { type: "need_wallet" };
  }

  return {
    type: "unknown",
    speech: "Try “show my collection”, “slideshow”, “next”, or “tell me about this”.",
  };
}
