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
