FXTRADE.live redesign package

This package redesigns the frontend around the supplied mobile reference:
- compact purple mobile trading layout
- volatility selector and live price area
- digit 0-9 strip
- AUTO / MANUAL switch
- stake/presets/target/stop/multiplier area
- LIVE / T / W / L / running profit bar
- AI signal card
- Over/Under, Even/Odd and Rise/Fall support through the existing app.js logic
- bottom Trade / AI / Positions navigation

The existing Deriv OAuth and trading code in app.js was retained and the completed
contract handler now accumulates trade count, wins, losses and actual contract profit.

Important: the running profit is not an artificial counter. It changes when a completed
Deriv contract reports its profit. Trading can lose money; the AI signal is informational.

Deploy the contents of this folder as the website root. Keep your existing Vercel
/api/oauth/token server route if your OAuth exchange depends on it.
