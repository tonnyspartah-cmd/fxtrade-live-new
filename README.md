# FXTRADE Independent Prototype

This version is a standalone **demo/prototype**. It does not execute real-money trades and does not connect to Deriv.

## Current architecture
- Browser UI for market, digits, contracts, stake, P/L and history.
- Simulated market/tick generator for testing.
- Local demo balance and simulated settlement.
- AI-signal module wired into the same simulated digit stream.
- Node server with `/api/health`.

## Important
The displayed signal/confidence is a prototype analysis of simulated digits, not a guarantee or prediction of real-market outcomes.

For a real-money platform, the prototype would need a separate production backend, authenticated accounts, server-side ledger, market-data/execution integration, settlement controls, payment processing, security, audit logs, and applicable legal/regulatory compliance.
