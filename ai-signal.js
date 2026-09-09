/*
 FXTRADE.live AI Signal Upgrade
 Keeps your existing layout/design.
 Feed the latest digits/ticks into analyzeAISignal(digits).

 Example:
 const result = analyzeAISignal([5,4,7,6,9,2,8,6,5,4]);
 // result.direction = "OVER", "UNDER", or "WAIT"
 // result.confidence = dynamic percentage
*/

function analyzeAISignal(digits) {
  const clean = (digits || [])
    .map(Number)
    .filter(d => Number.isInteger(d) && d >= 0 && d <= 9)
    .slice(-30);

  if (clean.length < 8) {
    return {
      direction: "WAIT",
      confidence: 0,
      strength: "WAIT",
      reason: "Waiting for more live tick data.",
      overProbability: 50,
      underProbability: 50
    };
  }

  // Over = 4-9, Under = 0-3
  const over = clean.filter(d => d >= 4).length / clean.length;
  const under = 1 - over;

  // Give recent ticks more weight.
  const recent = clean.slice(-10);
  const recentOver = recent.filter(d => d >= 4).length / recent.length;
  const recentUnder = 1 - recentOver;

  // Momentum: compare newest half with oldest half.
  const half = Math.max(2, Math.floor(clean.length / 2));
  const old = clean.slice(0, half);
  const newer = clean.slice(-half);
  const oldOver = old.filter(d => d >= 4).length / old.length;
  const newOver = newer.filter(d => d >= 4).length / newer.length;
  const momentum = newOver - oldOver;

  // Prediction digit = most frequent recent digit.
  const counts = Array(10).fill(0);
  clean.forEach(d => counts[d]++);
  let predictionDigit = 0;
  for (let i = 1; i < 10; i++) {
    if (counts[i] > counts[predictionDigit]) predictionDigit = i;
  }

  // Combine independent-looking signals.
  const overScore =
    (over * 0.40) +
    (recentOver * 0.40) +
    ((0.5 + momentum * 0.5) * 0.20);

  const underScore = 1 - overScore;
  const edge = Math.abs(overScore - underScore);

  let direction = "WAIT";
  if (edge >= 0.16) direction = overScore > underScore ? "OVER" : "UNDER";

  const confidence = Math.round(
    Math.min(92, 50 + edge * 100)
  );

  let strength = "WAIT";
  if (direction !== "WAIT") {
    strength = confidence >= 75 ? "STRONG" :
               confidence >= 62 ? "MEDIUM" : "WEAK";
  }

  const reasons = [];
  if (recentOver > 0.60) reasons.push("recent ticks favor OVER");
  else if (recentUnder > 0.60) reasons.push("recent ticks favor UNDER");
  else reasons.push("recent ticks are balanced");

  if (momentum > 0.10) reasons.push("OVER momentum rising");
  else if (momentum < -0.10) reasons.push("UNDER momentum rising");
  else reasons.push("momentum is mixed");

  reasons.push(`prediction digit ${predictionDigit}`);

  return {
    direction,
    confidence,
    strength,
    predictionDigit,
    overProbability: Math.round(overScore * 100),
    underProbability: Math.round(underScore * 100),
    reason: reasons.join(" • ")
  };
}

// Optional helper for your existing AI card.
function renderAISignal(result) {
  const signal = document.querySelector("#ai-signal");
  const confidence = document.querySelector("#ai-confidence");
  const strength = document.querySelector("#ai-strength");
  const reason = document.querySelector("#ai-reason");

  if (signal) {
    signal.textContent = result.direction;
    signal.dataset.signal = result.direction;
  }
  if (confidence) confidence.textContent = `Confidence: ${result.confidence}%`;
  if (strength) strength.textContent = result.strength;
  if (reason) reason.textContent = result.reason;
}
