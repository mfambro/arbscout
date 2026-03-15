# ArbScout — Prediction Market Arbitrage Bot

A multi-agent system for detecting and paper-trading cross-platform arbitrage on prediction markets (Polymarket, Kalshi, Manifold, Metaculus, PredictIt).

**Live demo:** `https://<your-username>.github.io/arbscout`

---

## Deploy to GitHub (5 minutes)

### 1. Create the repo

Go to [github.com/new](https://github.com/new):
- Repository name: `arbscout`
- Visibility: **Public** *(required for free GitHub Pages)*
- Do **not** initialise with README — you'll push your own files

### 2. Push the code

```bash
cd arbscout
git remote add origin https://github.com/<your-username>/arbscout.git
git push -u origin main
```

### 3. Enable GitHub Pages

In your repo on GitHub:
1. **Settings** → **Pages** (left sidebar)
2. Under **Source**, select **GitHub Actions**
3. Save

The workflow in `.github/workflows/deploy.yml` triggers automatically on every push to `main`. After ~1 minute your site is live at:

```
https://<your-username>.github.io/arbscout
```

### 4. Run it locally (no setup needed)

```bash
# Any static server works — no build step required
npx serve .
# or
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## Project structure

```
arbscout/
├── index.html                    # Entry point
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Actions → GitHub Pages
└── src/
    ├── style.css                 # Dark terminal aesthetic
    ├── markets.js                # Platform config + seed market data
    ├── engine.js                 # Core arbitrage engine (pure functions)
    ├── ui.js                     # DOM rendering layer
    └── app.js                    # State + agent orchestration
```

---

## How it works

### Agent pipeline

| Agent | Role |
|-------|------|
| **ScanAgent** | Fetches markets from each platform (paper: uses seed data) |
| **ClauseAgent** | Parses and compares resolution conditions |
| **IdentityAgent** | Scores how "identical" two bets are across 5 dimensions |
| **SpreadAgent** | Computes net spread after fees, ranks by expected value |
| **PriceAgent** | Polls prices every 8 s (paper: random walk simulation) |

### Identity scoring

The core risk control — guards against markets that *look* identical but resolve differently.

| Dimension        | Weight | What it checks |
|------------------|--------|----------------|
| Resolution logic | 40%    | Same event trigger and threshold? |
| Oracle / data    | 20%    | Same data source? |
| Resolution date  | 20%    | Same deadline? |
| Title match      | 10%    | Semantic similarity |
| Currency/payout  | 10%    | Both real USD? |

- Identity **≥ 80%** → green, execute freely
- Identity **60–79%** → amber, proceed with caution
- Identity **< 60%** → confirmation required
- Identity **< 40%** → avoid entirely

### Spread calculation

```
net_profit = (sell_price − buy_price) − (buy_price × fee_buy) − (sell_price × fee_sell)
```

Computed for both YES and NO legs across all platform pairs. Best pair is surfaced automatically.

---

## Going live (connecting real APIs)

### Step 1 — Add API keys

Edit `src/markets.js`:
```js
window.API_KEYS = {
  polymarket: 'YOUR_CLOB_API_KEY',
  kalshi:     'YOUR_KALSHI_API_KEY',
  predictit:  'YOUR_PREDICTIT_CREDENTIALS',
};
```

For production, expose these via a backend proxy — never commit secrets to the repo.

### Step 2 — Replace ScanAgent with real fetches

In `src/app.js`, replace the `ScanAgent()` body:

```js
async function ScanAgent() {
  const [poly, kalshi] = await Promise.all([
    fetch('/api/polymarket/markets').then(r => r.json()),
    fetch('/api/kalshi/markets').then(r => r.json()),
  ]);
  return { markets: normalise(poly, kalshi), scanned: poly.length + kalshi.length };
}
```

#### Platform API references

| Platform   | Endpoint | Auth |
|------------|----------|------|
| Polymarket | `https://clob.polymarket.com/markets` | `Authorization: Bearer {key}` |
| Kalshi     | `https://trading-api.kalshi.com/trade-api/v2/markets` | `Authorization: Token {key}` |
| Manifold   | `https://api.manifold.markets/v0/markets` | None (read) |
| Metaculus  | `https://www.metaculus.com/api2/questions/` | None (read) |
| PredictIt  | `https://www.predictit.org/api/marketdata/all/` | None (read) |

### Step 3 — Implement order placement

In `src/app.js`, extend `doExecuteTrade()`:

```js
async function doExecuteTrade(opp) {
  const sp = Engine.calcSpread(opp);
  await Promise.all([
    placeBet(sp.buyPlat,  opp, sp.side, sp.buyPrice,  STAKE),
    placeBet(sp.sellPlat, opp, sp.side, sp.sellPrice, STAKE),
  ]);
}
```

---

## Running in Claude Code (autonomous mode)

Add a `CLAUDE.md` at the repo root:

```markdown
# ArbScout — Claude Code config
Serve with: python3 -m http.server 8080
Main entry: src/app.js → ScanAgent()
Live data: connect Polymarket CLOB API (see README)
```

Then run:
```bash
claude "scan prediction markets and surface arbitrage opportunities"
```

---

## Risk warnings

- **Not financial advice.** Prediction market arbitrage carries real risk.
- Identical-looking markets can resolve differently due to clause nuances.
- **Execution risk:** prices move between detecting the spread and placing both legs.
- **Liquidity risk:** large positions may move the market against you.
- **Platform risk:** platforms can restrict accounts, delay payouts, or dispute resolutions.
- Always start with paper trading and small positions.

## Licence

MIT
