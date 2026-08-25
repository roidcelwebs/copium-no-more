export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Page didn't load — No More Copium</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { --bg: #fafafa; --card-bg: #ffffff; --text: #111827; --muted: #6b7280; --border: #e5e7eb; --primary: #111827; --primary-fg: #ffffff; --focus: #111827; }
      @media (prefers-color-scheme: dark) { :root { --bg: #0a0a0a; --card-bg: #171717; --text: #fafafa; --muted: #a1a1aa; --border: #27272a; --primary: #fafafa; --primary-fg: #0a0a0a; --focus: #fafafa; } }
      * { box-sizing: border-box; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 16px; line-height: 1.5; background: var(--bg); color: var(--text); display: grid; place-items: center; min-height: 100dvh; margin: 0; padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); -webkit-font-smoothing: antialiased; }
      .card { max-width: 32rem; width: 100%; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 2rem; box-shadow: 0 1px 2px rgba(0,0,0,0.04); text-align: left; }
      h1 { font-size: 1.375rem; line-height: 1.2; letter-spacing: -0.015em; margin: 0 0 0.75rem; font-weight: 600; }
      .lead { font-size: 1rem; line-height: 1.6; color: var(--text); margin: 0 0 1rem; }
      .muted { font-size: 1rem; line-height: 1.6; color: var(--muted); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
      a, button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0.75rem 1.25rem; border-radius: 12px; font-family: inherit; font-size: 1rem; font-weight: 600; line-height: 1; cursor: pointer; text-decoration: none; border: 1px solid transparent; transition: background-color 0.15s, border-color 0.15s; }
      a:focus-visible, button:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--focus); }
      .primary { background: var(--primary); color: var(--primary-fg); }
      .primary:hover { filter: brightness(0.92); }
      .secondary { background: var(--card-bg); color: var(--text); border-color: var(--border); }
      .secondary:hover { background: color-mix(in srgb, var(--border) 50%, var(--card-bg)); }
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
    </style>
  </head>
  <body>
    <div class="card" role="alert" aria-live="assertive">
      <h1>This page didn't load</h1>
      <p class="lead">What happened: This page didn't load because something unexpected happened while opening it.</p>
      <p class="muted">Why: This can happen if the browser's local data is temporarily unavailable or a recent change didn't load correctly. No personal data was sent anywhere — your No More Copium data stays only in this browser.</p>
      <p class="muted">What to do next: Try refreshing the page. If it still doesn't load, go back home and open the app again. If the problem continues, clear the browser tab and try again, or use the Export/Import backup in Settings if you have a backup file.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
