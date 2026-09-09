FXTRADE.live AI Signal Upgrade

Files:
- ai-signal.js  -> signal calculation
- ai-signal.html -> example integration

What it does:
- OVER/UNDER probability
- Recent tick weighting
- Momentum check
- Most frequent prediction digit
- Dynamic confidence
- STRONG / MEDIUM / WAIT
- Explanation/reason text

Important:
This is an analysis engine, not a guaranteed predictor. Binary/last-tick markets remain uncertain.

Integration:
1. Copy ai-signal.js into your website project.
2. Load it from the page containing your existing AI card.
3. When your live tick stream updates, call:
   updateAISignal([latest digits...])

Keep your existing CSS and layout unchanged.
