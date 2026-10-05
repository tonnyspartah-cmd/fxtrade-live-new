# FXTRADE.live — v29 fixed build

This build keeps the existing FXTRADE layout and fixes the main runtime/deployment blockers.

## Included
- Deriv public live market ticks and live chart
- Volatility market selector
- Last-digit percentages with moving red cursor and strongest/hot digit
- AI Deep Scan across supported volatility feeds
- Over/Under, Rise/Fall, Even/Odd contract modes
- Stake presets and editable tick duration
- Editable Stop Loss and Target Profit
- Session P/L plus wins/losses
- Stop/Resume control
- Demo/Real account selector and Deriv OAuth connection UI
- Local API proxy for authenticated Deriv REST requests
- OAuth token exchange routed through `server.js` for Vercel compatibility

## Deploy
Upload/extract the project files into the GitHub repository used by the Vercel project. Deploy from the repository root containing `index.html`, `app.js`, `styles.css`, `server.js`, `vercel.json`, and `api/`.

Before using a real account, connect a Deriv demo account and verify live ticks, proposals, contract settlement, P/L, and risk limits first.

The site does not guarantee profitable trading; Deep Scan is an analysis aid, not a guaranteed signal.
