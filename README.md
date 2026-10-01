# FXTRADE — Deriv OAuth v1

This version adds the official Deriv OAuth 2.0 Authorization Code flow with PKCE.

Registered redirect:
https://fxtrade-live-new.vercel.app/

Vercel Environment Variable:
DERIV_CLIENT_ID = your Deriv OAuth client ID

The client ID is public OAuth metadata; do not put any Deriv access token, password or PIN into the source.

Flow:
1. FXTRADE generates state + PKCE verifier.
2. User is redirected to Deriv OAuth.
3. Deriv returns an authorization code.
4. `/api/oauth-token.js` exchanges the code server-side.
5. The access token is stored in an HttpOnly cookie.
6. `/api/deriv-account.js` reads the cookie server-side and calls Deriv.

This version intentionally starts with authorization/account retrieval. Real-money order placement is not enabled until the account/contract flow is tested end-to-end.

Deriv documentation:
https://developers.deriv.com/docs/intro/oauth/
