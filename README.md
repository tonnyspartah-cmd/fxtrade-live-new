# FXTRADE.live purple Deriv build

Files:
- index.html
- styles.css
- app.js
- api/oauth/token.js

Features:
- Purple mobile layout based on the supplied reference image
- Live Deriv public tick feed
- Volatility market selector
- Matches/Differs, Even/Odd, Over/Under, Rise/Fall
- Moving digit cursor under the current last digit
- Strongest digit green highlight remains separate from the cursor
- AUTO / MANUAL visual mode switch
- Editable stake, Target Profit, Stop Loss and Multiplier
- Deriv OAuth 2.0 connection
- Demo/Real account selector
- Authenticated balance and contract trading after Deriv connection
- Risk limits pause new trades after the configured session threshold

Deployment:
Upload the files preserving the folders, especially `api/oauth/token.js`.
The registered Deriv OAuth redirect URL must exactly match the deployed site's origin + `/`.


## Real-account connection
This build adds Demo/Real account mode and Deriv OAuth 2.0 account connection. Deriv's current API uses OAuth 2.0 with the `trade` scope for web dashboards, then an authenticated WebSocket URL obtained from the account OTP endpoint for account-scoped streaming/trading. The real-account mode in this build loads the user's Deriv Options accounts and live balance after authentication. Actual real-money order placement remains intentionally gated until the contract proposal/buy mapping is tested for each selected contract type.

### Required before deployment
1. Register an OAuth 2.0 application at developers.deriv.com.
2. Register the exact Vercel URL as the OAuth redirect URI (this app uses `https://YOUR-DOMAIN/`).
3. The first time Connect Deriv is pressed, enter the Deriv OAuth Client ID. It is stored locally in the browser.
4. Do not put a Deriv client secret or personal access token in `index.html` or `app.js`.
