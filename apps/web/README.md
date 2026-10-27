# Waku Web

Browser client for an existing Waku daemon. It ships as a static SPA: the build
is plain HTML/JS/CSS you can host anywhere, and there is no server component —
nothing starts, proxies, or stores credentials for a daemon.

```sh
bun --filter @waku/web dev
```

Then add a daemon WebSocket URL and token in the connection screen. The daemon
must be reachable through `wss://` in production and started with this site's
exact browser origin in its `--allow-origin` list. For local development the
origin is `http://localhost:3001`.

```sh
WAKU_DAEMON_TOKEN=replace-me cargo run -p waku-daemon --bin waku-daemon -- \
  --bind 127.0.0.1:34123 \
  --allow-origin http://localhost:3001
```

Waku Desktop can expose the daemon it manages from Settings → Daemon, where you
choose the port and exact browser origins and copy the URL/token. A standalone
daemon requires the explicit `--allow-non-loopback` flag for a non-loopback
bind. For access outside a private network, put a trusted TLS reverse proxy or
tunnel in front of the listener, forward WebSockets, and use `wss://`.

```sh
bun --filter @waku/web build
```

The output is `apps/web/dist/client/` — `index.html` plus content-hashed
`assets/`. `dist/server/` is a prerender intermediate; never deploy it.

Host `dist/client` on any static file server and configure a SPA fallback so
unmatched paths serve `index.html` (otherwise deep links 404). Serve
`index.html` uncached and `assets/*` with a long cache lifetime, since those
filenames are hashed.

The token is a full-control daemon capability. It is sent directly from the
browser to the configured daemon and is never submitted to any hosting server.
Persistent connections use browser local storage; leave “Remember” off to keep
it in session storage instead.

Task state, transcripts, workspaces, Git operations, attachments, and provider
processes all remain daemon-owned. The browser only keeps rendered query state
and composer input in memory.
