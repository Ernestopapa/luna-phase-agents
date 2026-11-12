# Deploy Luna Phase Agents to Cloudflare Pages via GitHub — DETAILED

Site package: `site-deploy-v6-2026-11-02-polished.zip` (2 files: `index.html`, `llms.txt`).
Live contract: 0x5c04392641c81F1b69826E13d8f3F78c58464970 (BSC mainnet).
Repo: github.com/Ernestopapa/luna-phase-agents — STATUS 2026-11-02 ~17:19 GMT:
`index.html` and `llms.txt` are ALREADY in the repo. Part A is done. Only Part B remains.

## PART A — GitHub (DONE — skip this)
1. Repo created: Ernestopapa/luna-phase-agents (public).
2. Files uploaded: `index.html` + `llms.txt` at the repo root. Verified via the GitHub API.
3. If you ever need to re-upload: repo page → scroll to the light-blue "Quick setup" box →
   click the link "uploading an existing file" → drag both files in → green "Commit changes".

## PART B — Cloudflare Pages (do this now)
You are on the Cloudflare dashboard home (dash.cloudflare.com).

1. Left sidebar, click **Compute** (the very first item).
   A submenu opens underneath it. Click **Workers & Pages**.
2. On the Workers & Pages page, click the **Create** button (top right).
   A panel opens with two tabs: Workers and Pages. Click the **Pages** tab.
3. Click **Connect to Git**.
4. If it asks to connect GitHub:
   - Click **Connect GitHub** (or "Connect to GitHub"). A GitHub page opens.
   - GitHub asks to install the "Cloudflare Pages" app. Choose **Only select repositories**,
     tick **luna-phase-agents**, then click **Install & Authorize**.
   - You come back to Cloudflare automatically.
5. Cloudflare shows a list of your repos. Click **Ernestopapa/luna-phase-agents**,
   then click **Begin setup**.
6. Fill in the setup form exactly like this:
   - Project name: `luna-phase-agents`
   - Production branch: `main` (already selected — leave it)
   - Framework preset: `None`
   - Build command: leave EMPTY
   - Build output directory: leave EMPTY
   - Root directory: leave as `/`
7. Click **Save and Deploy**.
8. Wait about a minute. The page shows a build log. When it says
   "Success! Your project is deployed", click **Visit site** — or open
   https://luna-phase-agents.pages.dev directly.
9. The site should look exactly like the preview. The wallet checker reads the
   live chain, so it works immediately.

## If the GitHub connection step confuses you — the shortcut
On the Cloudflare home page there is a card that says "Drop a folder, or a zip".
Drag the v6 zip file straight onto it, name the project `luna-phase-agents`,
click Deploy. The site goes live the same way, just without the GitHub
auto-update. You can connect the repo to the project later from its Settings.

## Updating later
Edit `index.html` / `llms.txt` on GitHub (pencil icon) or push new files →
Cloudflare redeploys automatically in ~1 minute. That is also how the minted
count snapshot gets refreshed: the live checker always shows the real number,
but the banner and footer counts are a static snapshot from the last edit.

## Notes
- Never commit `.env.testnet`, `.env.mainnet`, or any private key — they are not part of the site files.
- If the `luna-phase-agents` project name is taken, pick another (e.g. `lunaphaseagents`) — only the URL changes, nothing else does.
