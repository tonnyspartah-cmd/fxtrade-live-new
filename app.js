
document.addEventListener("DOMContentLoaded", () => {
  document.body.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="logo">FX<span>TRADE</span><small>.live</small></div>
        <div class="tagline">TRADE SMARTER • PROFIT MORE</div>

        <nav>
          <button>⌂ <span>Home</span></button>
          <button class="active">▣ <span>Trade</span></button>
          <button>◉ <span>AI Analyzer</span></button>
          <button>◷ <span>History</span></button>
          <button>▣ <span>Wallet</span></button>
          <button>⚙ <span>Settings</span></button>
          <button>?</button>
        </nav>

        <div class="upgrade">
          <b>FXTRADE AI</b>
          <p>Smarter analysis for better decisions.</p>
          <button>Upgrade</button>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <h2>AI Trading Dashboard</h2>
            <p>Real-time intelligent market analysis</p>
          </div>

          <div class="account">
            <span>Demo Account</span>
            <strong>$9,890.66 USD</strong>
            <i>●</i>
          </div>
        </header>

        <section class="title">
          <div>
            <h1>FXTRADE AI ANALYZER</h1>
            <p>Real-time market analysis | Smart signals | Better decisions</p>
          </div>
          <div class="live">● LIVE ANALYSIS</div>
        </section>

        <section class="summary">
          <div class="card">
            <label>MARKET</label>
            <b>Volatility 100 (1s)</b>
          </div>
          <div class="card">
            <label>TREND</label>
            <b class="green">BULLISH</b>
          </div>
          <div class="card">
            <label>MOMENTUM</label>
            <b class="green">STRONG</b>
          </div>
          <div class="card">
            <label>OVER / UNDER 3</label>
            <b class="blue">POSSIBLE OVER</b>
          </div>
        </section>

        <section class="controls">
          <div>
            <label>Market</label>
            <select>
              <option>Volatility 100 (1s)</option>
              <option>Volatility 10 (1s)</option>
            </select>
          </div>

          <div>
            <label>Contract Type</label>
            <select>
              <option>Over / Under</option>
              <option>Even / Odd</option>
              <option>Rise / Fall</option>
            </select>
          </div>

          <div>
            <label>Candle Interval</label>
            <select>
              <option>1 Minute</option>
              <option>5 Minutes</option>
            </select>
          </div>

          <div>
            <label>Last Digit</label>
            <div class="digit">7</div>
          </div>
        </section>

        <section class="workspace">

          <div class="analysis-panel">
            <div class="panel-head">
              <h2>AI MARKET ANALYZER</h2>
              <span>AI</span>
            </div>

            <div class="confidence">
              <div>
                <small>AI CONFIDENCE</small>
                <strong>82%</strong>
              </div>
              <div>
                <small>LAST DIGIT</small>
                <strong>7</strong>
              </div>
              <div>
                <small>SIGNAL</small>
                <strong class="green">SETUP READY</strong>
              </div>
            </div>

            <div class="recommendation">
              <span>AI RECOMMENDATION</span>
              <b>OVER</b>
              <small>Risk Level: <em>MEDIUM</em></small>
            </div>

            <div class="tabs">
              <button class="selected">Last Digit</button>
              <button>Even / Odd</button>
            </div>

            <div class="digits">
              <div>0</div>
              <div>1</div>
              <div>2</div>
              <div>3</div>
              <div>4</div>
              <div>5</div>
              <div>6</div>
              <div class="predicted">7</div>
              <div>8</div>
              <div>9</div>
            </div>

            <div class="ai-message">
              <b>AI Analysis</b>
              <p>
                Market momentum is currently strong. The AI model detects
                a bullish setup and indicates a possible OVER opportunity.
                Always manage your risk before placing a trade.
              </p>
            </div>

            <button class="analyze" onclick="analyzeMarket()">
              ✦ ANALYZE MARKET
            </button>
          </div>

          <div class="chart-panel">
            <div class="chart-head">
              <div>
                <b>Volatility 100 (1s)</b>
                <span> • 1m</span>
              </div>
              <span class="price" id="price">9,890.66</span>
            </div>

            <div class="chart">
              <div class="grid"></div>

              <div class="candle c1"></div>
              <div class="candle c2"></div>
              <div class="candle c3"></div>
              <div class="candle c4"></div>
              <div class="candle c5"></div>
              <div class="candle c6"></div>
              <div class="candle c7"></div>
              <div class="candle c8"></div>
              <div class="candle c9"></div>
              <div class="candle c10"></div>
              <div class="candle c11"></div>
              <div class="candle c12"></div>
            </div>

            <div class="chart-note">
              AI is analyzing live market movement...
            </div>
          </div>

          <div class="trade-panel">
            <h2>PLACE TRADE</h2>

            <label>STAKE (USD)</label>
            <input id="stake" type="number" value="5" min="1">

            <div class="stakes">
              <button onclick="setStake(5)">$5</button>
              <button onclick="setStake(10)">$10</button>
              <button onclick="setStake(20)">$20</button>
              <button onclick="setStake(50)">$50</button>
            </div>

            <label>DURATION</label>
            <select>
              <option>1 Tick</option>
              <option>5 Ticks</option>
              <option>10 Ticks</option>
            </select>

            <div class="payout">
              <span>Potential Payout</span>
              <strong id="payout">$9.80</strong>
              <small>+96%</small>
            </div>

            <button class="trade" onclick="placeTrade()">
              PLACE TRADE
            </button>

            <p class="warning">
              Trading involves risk. Use responsible stake management.
            </p>
          </div>

        </section>

        <footer>
          <div>🔒 Secure Trading</div>
          <div>⚡ Fast Execution</div>
          <div>◉ 24/7 Support</div>
          <strong>FXTRADE.live</strong>
        </footer>
      </main>
    </div>

    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
      }

      body {
        background: #060b14;
        color: #eaf2ff;
      }

      .app {
        display: flex;
        min-height: 100vh;
      }

      .sidebar {
        width: 235px;
        background: #08111e;
        border-right: 1px solid #17263a;
        padding: 25px 15px;
        position: fixed;
        top: 0;
        bottom: 0;
      }

      .logo {
        font-size: 25px;
        font-weight: 900;
        color: white;
      }

      .logo span {
        color: #168cff;
      }

      .logo small {
        color: #42aaff;
      }

      .tagline {
        font-size: 8px;
        color: #6d819c;
        margin: 5px 0 30px;
      }

      nav button {
        width: 100%;
        border: 0;
        background: transparent;
        color: #8799b2;
        padding: 14px;
        margin-bottom: 5px;
        text-align: left;
        border-radius: 8px;
        cursor: pointer;
        font-size: 15px;
      }

      nav button span {
        margin-left: 10px;
      }

      nav button:hover,
      nav .active {
        background: #102844;
        color: #38a5ff;
      }

      .upgrade {
        background: #0d1d31;
        border: 1px solid #183b60;
        border-radius: 12px;
        padding: 15px;
        margin-top: 35px;
        color: #a8bdd7;
        font-size: 12px;
      }

      .upgrade b {
        color: #35a8ff;
      }

      .upgrade p {
        margin: 8px 0;
      }

      .upgrade button {
        width: 100%;
        background: #087df0;
        border: 0;
        padding: 8px;
        border-radius: 6px;
        color: white;
      }

      main {
        margin-left: 235px;
        width: calc(100% - 235px);
        padding: 20px 28px;
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #17263a;
        padding-bottom: 18px;
      }

      header h2 {
        font-size: 21px;
      }

      header p {
        color: #70839e;
        font-size: 12px;
        margin-top: 5px;
      }

      .account {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 12px;
        color: #8da0b9;
      }

      .account strong {
        color: white;
      }

      .account i {
        color: #22d889;
      }

      .title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 28px 0 18px;
      }

      .title h1 {
        font-size: 25px;
      }

      .title p {
        color: #7186a1;
        font-size: 12px;
        margin-top: 5px;
      }

      .live {
        background: #092719;
        border: 1px solid #126d43;
        color: #31df8a;
        padding: 9px 14px;
        border-radius: 20px;
        font-size: 10px;
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }

      .card,
      .controls,
      .analysis-panel,
      .chart-panel,
      .trade-panel {
        background: #0a1422;
        border: 1px solid #172b43;
        border-radius: 10px;
      }

      .card {
        padding: 17px;
      }

      label,
      .card label,
      .confidence small {
        display: block;
        color: #6f849f;
        font-size: 9px;
        margin-bottom: 7px;
      }

      .card b {
        font-size: 13px;
      }

      .green {
        color: #28db83 !important;
      }

      .blue {
        color: #32a7ff !important;
      }

      .controls {
        margin-top: 15px;
        padding: 15px;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr .5fr;
        gap: 15px;
      }

      select,
      input {
        width: 100%;
        background: #07101c;
        border: 1px solid #223953;
        color: #dce9fa;
        padding: 11px;
        border-radius: 6px;
        outline: none;
      }

      .digit {
        background: #10243b;
        border: 1px solid #147ed1;
        color: #39a9ff;
        text-align: center;
        padding: 9px;
        border-radius: 6px;
        font-weight: bold;
      }

      .workspace {
        display: grid;
        grid-template-columns: 1.2fr 1.6fr .75fr;
        gap: 15px;
        margin-top: 15px;
      }

      .analysis-panel,
      .chart-panel,
      .trade-panel {
        padding: 18px;
      }

      .panel-head,
      .chart-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .panel-head h2,
      .trade-panel h2 {
        font-size: 14px;
      }

      .panel-head span {
        background: #0c4d81;
        padding: 6px 9px;
        border-radius: 6px;
        color: #5dbaff;
        font-size: 10px;
      }

      .confidence {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-top: 18px;
      }

      .confidence div {
        background: #0d1d2f;
        padding: 12px;
        border-radius: 7px;
      }

      .confidence strong {
        font-size: 14px;
      }

      .recommendation {
        margin-top: 12px;
        background: #071a2b;
        border: 1px solid #0c568a;
        padding: 13px;
        border-radius: 8px;
      }

      .recommendation span,
      .recommendation small {
        color: #7890ab;
        font-size: 9px;
      }

      .recommendation b {
        display: block;
        color: #36a9ff;
        font-size: 22px;
        margin: 5px 0;
      }

      .recommendation em {
        color: #ffc247;
        font-style: normal;
      }

      .tabs {
        display: flex;
        margin-top: 15px;
      }

      .tabs button {
        flex: 1;
        padding: 9px;
        background: #091421;
        border: 1px solid #1b3048;
        color: #7890ab;
      }

      .tabs .selected {
        color: #42aaff;
        border-color: #168cff;
      }

      .digits {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 6px;
        margin-top: 10px;
      }

      .digits div {
        text-align: center;
        padding: 10px;
        background: #0e1d2d;
        border-radius: 5px;
        color: #9fb2ca;
      }

      .digits .predicted {
        color: #fff;
        background: #07558e;
        border: 1px solid #26a5ff;
      }

      .ai-message {
        margin-top: 13px;
        font-size: 11px;
        color: #8094ad;
        line-height: 1.5;
      }

      .ai-message b {
        color: #36a8ff;
      }

      .analyze {
        width: 100%;
        margin-top: 12px;
        padding: 11px;
        border: 0;
        border-radius: 6px;
        background: #087ff1;
        color: white;
        font-weight: bold;
      }

      .chart-head b {
        font-size: 13px;
      }

      .chart-head span {
        color: #7187a2;
        font-size: 11px;
      }

      .price {
        color: #27dc83 !important;
      }

      .chart {
        height: 290px;
        margin-top: 18px;
        position: relative;
        overflow: hidden;
        background:
          linear-gradient(#132235 1px, transparent 1px),
          linear-gradient(90deg, #132235 1px, transparent 1px);
        background-size: 50px 50px;
        border-radius: 7px;
      }

      .candle {
        position: absolute;
        width: 10px;
        background: #24d982;
        border-radius: 2px;
      }

      .candle:before {
        content: "";
        position: absolute;
        width: 2px;
        height: 15px;
        background: inherit;
        left: 4px;
        top: -12px;
      }

      .c1 { left: 8%; top: 62%; height: 45px; }
      .c2 { left: 15%; top: 54%; height: 55px; background:#ef5368; }
      .c3 { left: 22%; top: 48%; height: 65px; }
      .c4 { left: 29%; top: 55%; height: 40px; background:#ef5368; }
      .c5 { left: 36%; top: 43%; height: 70px; }
      .c6 { left: 43%; top: 35%; height: 80px; }
      .c7 { left: 50%; top: 41%; height: 55px; background:#ef5368; }
      .c8 { left: 57%; top: 30%; height: 75px; }
      .c9 { left: 64%; top: 37%; height: 65px; }
      .c10 { left: 71%; top: 25%; height: 82px; }
      .c11 { left: 78%; top: 31%; height: 68px; background:#ef5368; }
      .c12 { left: 85%; top: 20%; height: 85px; }

      .chart-note {
        color: #5d728c;
        font-size: 10px;
        margin-top: 10px;
      }

      .trade-panel h2 {
        margin-bottom: 20px;
      }

      .stakes {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        margin: 8px 0 18px;
      }

      .stakes button {
        background: #102136;
        border: 1px solid #203953;
        color: #9cb2ca;
        padding: 7px 2px;
        border-radius: 4px;
      }

      .payout {
        background: #0d1e30;
        margin-top: 15px;
        padding: 13px;
        border-radius: 7px;
      }

      .payout span {
        display: block;
        color: #7186a0;
        font-size: 9px;
      }

      .payout strong {
        font-size: 20px;
        display: inline-block;
        margin-top: 6px;
      }

      .payout small {
        color: #28dc83;
        margin-left: 5px;
      }

      .trade {
        width: 100%;
        margin-top: 12px;
        padding: 13px;
        border: 0;
        border-radius: 6px;
        background: #087ff1;
        color: white;
        font-weight: bold;
      }

      .warning {
        color: #5f738d;
        font-size: 9px;
        line-height: 1.4;
        margin-top: 12px;
      }

      footer {
        display: flex;
        justify-content: space-between;
        padding: 22px 5px 5px;
        color: #60748e;
        font-size: 10px;
      }

      footer strong {
        color: #238fe7;
      }

      @media (max-width: 900px) {
        .sidebar {
          width: 70px;
        }

        .sidebar .logo,
        .tagline,
        nav button span,
        .upgrade {
          display: none;
        }

        main {
          margin-left: 70px;
          width: calc(100% - 70px);
          padding: 15px;
        }

        .summary,
        .workspace {
          grid-template-columns: 1fr;
        }

        .controls {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 600px) {
        header .account {
          display: none;
        }

        .title {
          align-items: flex-start;
          gap: 10px;
          flex-direction: column;
        }

        .controls {
          grid-template-columns: 1fr;
        }

        footer {
          flex-wrap: wrap;
          gap: 12px;
        }
      }
    </style>
  `;

  window.setStake = function(amount) {
    document.getElementById("stake").value = amount;
    updatePayout();
  };

  function updatePayout() {
    const stake = Number(document.getElementById("stake").value) || 0;
    document.getElementById("payout").textContent =
      "$" + (stake * 1.96).toFixed(2);
  }

  document.getElementById("stake").addEventListener("input", updatePayout);

  window.analyzeMarket = function() {
    const button = document.querySelector(".analyze");
    button.textContent = "⟳ ANALYZING...";
    
    setTimeout(() => {
      button.textContent = "✓ ANALYSIS COMPLETE";
      setTimeout(() => {
        button.textContent = "✦ ANALYZE MARKET";
      }, 1500);
    }, 1000);
  };

  window.placeTrade = function() {
    const stake = document.getElementById("stake").value;
    alert(
      "Demo Trade\\n\\n" +
      "Market: Volatility 100 (1s)\\n" +
      "Prediction: OVER\\n" +
      "Stake: $" + stake
    );
  };
});
After pasting it: tap “Commit changes…” at the top. Then we'll do the next step together.
