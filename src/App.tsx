import { FormEvent, useEffect, useMemo, useState } from "react";
import { interpret } from "./commands";
import { callTool, connectMantel } from "./mcpClient";
import { SAMPLE_COLLECTION, SAMPLE_OWNER } from "./sample";
import type { Collectible } from "./types";

type Mode = "home" | "gallery" | "detail" | "slideshow";

type SpeechRecognitionResultEvent = {
  results: { [index: number]: { [index: number]: { transcript: string } } };
};

type BrowserSpeech = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

function shorten(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function speak(text: string, enabled: boolean) {
  if (!enabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function App() {
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState<Mode>("home");
  const [owner, setOwner] = useState("");
  const [walletDraft, setWalletDraft] = useState("");
  const [command, setCommand] = useState("");
  const [items, setItems] = useState<Collectible[]>([]);
  const [focus, setFocus] = useState(0);
  const [speech, setSpeech] = useState("Say, show my collection.");
  const [toolCall, setToolCall] = useState("Waiting for initialize");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");

  const focused = items[focus];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    connectMantel()
      .then(() => {
        setConnected(true);
        setToolCall("initialize · MCP 2025-11-25");
      })
      .catch((error: unknown) => {
        setConnectionError(error instanceof Error ? error.message : "Could not reach the Mantel server.");
      });
  }, []);

  useEffect(() => {
    if (mode !== "slideshow" || items.length < 2) return;
    const timer = window.setInterval(() => {
      setFocus((index) => (index + 1) % items.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [mode, items.length]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === "ArrowRight") shift(1);
      if (event.key === "ArrowLeft") shift(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const collections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.collectionName, (counts.get(item.collectionName) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [items]);

  function say(text: string) {
    setSpeech(text);
    speak(text, voiceOn);
  }

  function shift(direction: number) {
    if (!items.length) return;
    setFocus((index) => (index + direction + items.length) % items.length);
    setMode((current) => (current === "home" ? "detail" : current));
  }

  async function loadWallet(nextOwner: string, collection?: string) {
    setBusy(true);
    setToolCall(collection ? "tools/call · list_collectibles" : "tools/call · list_collectibles");
    try {
      const payload = await callTool("list_collectibles", {
        owner: nextOwner,
        ...(collection ? { collection } : {}),
        limit: 24,
      });
      const nextItems = payload.items ?? [];
      setOwner(nextOwner);
      setItems(nextItems);
      setFocus(0);
      setMode(nextItems.length ? "gallery" : "home");
      say(payload.speech);
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not read that wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function describe(item: Collectible) {
    setBusy(true);
    setToolCall("tools/call · get_collectible");
    setMode("detail");
    try {
      const payload = await callTool("get_collectible", { mint: item.mint });
      if (payload.item) {
        setItems((current) => current.map((entry) => (entry.mint === payload.item?.mint ? payload.item! : entry)));
      }
      say(payload.speech);
    } catch (error) {
      say(error instanceof Error ? error.message : "Could not describe that piece.");
    } finally {
      setBusy(false);
    }
  }

  async function runCommand(raw: string) {
    const intent = interpret(raw, { owner, hasFocus: Boolean(focused) });
    if (intent.type === "unknown") {
      say(intent.speech);
      return;
    }
    if (intent.type === "need_wallet") {
      setMode("home");
      say("Paste a Solana address, or preview a public wallet.");
      return;
    }
    if (intent.type === "home") {
      setMode("home");
      say("Back on the shelf.");
      return;
    }
    if (intent.type === "gallery") {
      setMode(items.length ? "gallery" : "home");
      say(items.length ? "Back to the gallery." : "Nothing is on the wall yet.");
      return;
    }
    if (intent.type === "slideshow") {
      if (!items.length) {
        say("Load a wallet first, then I can start the slideshow.");
        return;
      }
      setMode("slideshow");
      setToolCall("frame mode");
      say(`Slideshow started. ${items.length} pieces.`);
      return;
    }
    if (intent.type === "next") {
      shift(1);
      return;
    }
    if (intent.type === "prev") {
      shift(-1);
      return;
    }
    if (intent.type === "detail") {
      if (focused) await describe(focused);
      return;
    }
    await loadWallet(intent.owner, intent.collection);
  }

  function onCommand(event: FormEvent) {
    event.preventDefault();
    const next = command.trim();
    if (!next || busy) return;
    setCommand("");
    void runCommand(next);
  }

  function onWallet(event: FormEvent) {
    event.preventDefault();
    const next = walletDraft.trim();
    if (!next || busy) return;
    void runCommand(next);
  }

  function listen() {
    const Recognition = (
      window as Window & {
        SpeechRecognition?: new () => BrowserSpeech;
        webkitSpeechRecognition?: new () => BrowserSpeech;
      }
    ).SpeechRecognition || (
      window as Window & { webkitSpeechRecognition?: new () => BrowserSpeech }
    ).webkitSpeechRecognition;
    if (!Recognition) {
      say("This browser has no microphone dictation. Type the command instead.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setCommand(transcript);
      void runCommand(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  const clock = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <main className="room">
      <p className="room-note">Echo Show simulator. No Alexa device and no seed phrase.</p>
      <section className="device" aria-label="Mantel display">
        <div className="screen">
          <header className="status">
            <span>{clock}</span>
            <span className={connected ? "link on" : "link"}>{connected ? "Mantel connected" : "Connecting"}</span>
          </header>

          <div className="stage">
            {connectionError ? <p className="banner">{connectionError}. Start the app with npm run dev.</p> : null}

            {mode === "home" ? (
              <div className="home">
                <p className="eyebrow">{greeting(now)}</p>
                <h1>Mantel</h1>
                <p className="lede">A frame for the Solana collectibles in a wallet.</p>
                <form className="wallet-form" onSubmit={onWallet}>
                  <label htmlFor="wallet">Wallet address</label>
                  <input
                    id="wallet"
                    value={walletDraft}
                    onChange={(event) => setWalletDraft(event.target.value)}
                    placeholder="Paste a public Solana address"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="row">
                    <button className="primary" type="submit" disabled={busy}>
                      Show collection
                    </button>
                    <button
                      className="ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => void loadWallet(SAMPLE_OWNER, SAMPLE_COLLECTION)}
                    >
                      Preview a public wallet
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {mode === "gallery" ? (
              <div className="gallery">
                <div className="gallery-head">
                  <div>
                    <p className="eyebrow">{shorten(owner)}</p>
                    <h2>{items.length} on the wall</h2>
                  </div>
                  <button type="button" className="ghost" onClick={() => setMode("slideshow")}>
                    Slideshow
                  </button>
                </div>
                <div className="chips">
                  <button type="button" onClick={() => void loadWallet(owner)}>
                    Entire wallet
                  </button>
                  {collections.map(([name]) => (
                    <button key={name} type="button" onClick={() => void loadWallet(owner, name)}>
                      {name}
                    </button>
                  ))}
                </div>
                <div className="grid">
                  {items.map((item, index) => (
                    <button
                      key={item.mint}
                      type="button"
                      className="card"
                      onClick={() => {
                        setFocus(index);
                        void describe(item);
                      }}
                    >
                      {item.image ? (
                        <img src={item.image} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="missing">No image</span>
                      )}
                      <span>
                        <strong>{item.name}</strong>
                        <em>{item.collectionName}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {mode === "detail" && focused ? (
              <article className="detail">
                {focused.image ? (
                  <img src={focused.image} alt={focused.name} referrerPolicy="no-referrer" />
                ) : (
                  <div className="missing large">No image</div>
                )}
                <div>
                  <p className="eyebrow">{focused.collectionName}</p>
                  <h2>{focused.name}</h2>
                  <ul>
                    {focused.attributes.slice(0, 6).map((trait) => (
                      <li key={`${trait.trait_type}-${trait.value}`}>
                        <span>{trait.trait_type}</span>
                        {trait.value}
                      </li>
                    ))}
                  </ul>
                  <div className="row">
                    <button type="button" className="ghost" onClick={() => shift(-1)}>
                      Previous
                    </button>
                    <button type="button" className="ghost" onClick={() => shift(1)}>
                      Next
                    </button>
                    <button type="button" className="ghost" onClick={() => setMode("gallery")}>
                      Gallery
                    </button>
                  </div>
                  <a href={focused.magicEdenUrl} target="_blank" rel="noreferrer">
                    View on Magic Eden
                  </a>
                </div>
              </article>
            ) : null}

            {mode === "slideshow" && focused ? (
              <div className="slideshow">
                {focused.image ? (
                  <img src={focused.image} alt={focused.name} referrerPolicy="no-referrer" />
                ) : (
                  <div className="missing large">No image</div>
                )}
                <div className="caption">
                  <strong>{focused.name}</strong>
                  <span>{focused.collectionName}</span>
                  <div className="row">
                    <button type="button" className="ghost" onClick={() => shift(-1)}>
                      Previous
                    </button>
                    <button type="button" className="ghost" onClick={() => shift(1)}>
                      Next
                    </button>
                    <button type="button" className="ghost" onClick={() => setMode("gallery")}>
                      Gallery
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <form className="dock" onSubmit={onCommand}>
            <p className="speech">{busy ? "Looking through the wallet…" : speech}</p>
            <p className="trace">{toolCall}</p>
            <div className="dock-row">
              <input
                aria-label="Say something to Mantel"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder='Try “slideshow”, “only Mad Lads”, “tell me about this”'
                disabled={busy}
              />
              <button type="button" className={listening ? "mic on" : "mic"} onClick={listen} disabled={busy}>
                {listening ? "Listening" : "Mic"}
              </button>
              <button type="submit" className="primary" disabled={busy}>
                Say
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setVoiceOn((value) => !value);
                  if (voiceOn) window.speechSynthesis?.cancel();
                }}
              >
                {voiceOn ? "Mute" : "Speak"}
              </button>
            </div>
          </form>
        </div>
      </section>
      <p className="credit">
        Collectible data from the public{" "}
        <a href="https://magiceden.io" target="_blank" rel="noreferrer">
          Magic Eden
        </a>{" "}
        API. Read only.
      </p>
    </main>
  );
}
