FXTRADE.live — Deriv OAuth connection

This version keeps the existing FXTRADE.live design and AI signal and adds a Deriv OAuth connection layer.

Included:
- Deriv OAuth 2.0 + PKCE login
- Server-side OAuth token exchange at /api/oauth/token
- Demo Options account lookup
- Authenticated Deriv demo WebSocket session via OTP
- Live Deriv demo balance shown after connection
- Authenticated tick stream used alongside the existing public market feed

Deriv app settings used:
- App name: fxtrade_live
- Scope: trade
- Redirect URL: https://fxtrade-live-new.vercel.app/
- Markup: 3%

Important:
- The Deriv App ID is included in app.js because it is a client identifier, not a secret.
- No password, PIN, or personal access token is stored in this project.
- The existing Place Demo Trade button is still the site's local demo settlement. Real Deriv contract purchase is intentionally the next integration step after confirming OAuth/account connection works.


REAL/DEMO TRADING INTEGRATION
- Demo is the default.
- The account selector can switch between DEMO and REAL when Deriv provides both.
- OVER/UNDER buttons request a Deriv proposal and immediately buy the returned contract.
- The center Place button follows the current AI direction.
- Real trading uses the selected real Options account and real balance.
- This does not guarantee profitable outcomes; signals are informational.
