(() => {
'use strict';

const $ = id => document.getElementById(id);

const state = {
  ws: null,
  symbol: '1HZ100V',
  prices: [],
  digits: Array(10).fill(0),
  stake: 5,
  contract: 'OVERUNDER',
  balance: 0,
  accountType: 'demo',
  accountId: null,
  currency: 'USD',
  reconnect: null,
  authenticated: false,
  waitingForProposal: null,
  proposalReqId: 0,
  buyReqId: 0,
  contractReqId: 0,
  tradeCount: 0,
  winCount: 0,
  lossCount: 0,
  profitTotal: 0,
  autoMode: true
};

const DERIV_CLIENT_ID = '34m6kBZ1JQGXBHSscpXXQ';
const DERIV_REDIRECT_URI = window.location.origin + '/';
const DERIV_API = 'https://api.derivws.com';

const auth = {
  token: sessionStorage.getItem('deriv_access_token') || null
};

const ui = {
  price: $('price'),
  digit: $('digitBig'),
  confidence: $('confidence'),
  direction: $('direction'),
  grid: $('digitGrid'),
  strongest: $('strongestDigit'),
  strongestPct: $('strongestPct'),
  connection: $('connection'),
  balance: $('balance'),
  payout: $('payout'),
  stake: $('stake'),
  connect: $('connectDeriv'),
  accountType: $('accountType'),
  accountLabel: $('accountLabel'),
  tradeCount: $('tradeCount'),
  winCount: $('winCount'),
  lossCount: $('lossCount'),
  profitTotal: $('profitTotal'),
  aiReason: $('aiReason')
};

const marketSelect = $('market');

const publicFeed = 'wss://api.derivws.com/trading/v1/options/ws/public';

const fallbackVolatilities = [
  ['1HZ100V', 'Volatility 100 (1s) Index'],
  ['1HZ90V', 'Volatility 90 (1s) Index'],
  ['1HZ75V', 'Volatility 75 (1s) Index'],
  ['1HZ50V', 'Volatility 50 (1s) Index'],
  ['1HZ30V', 'Volatility 30 (1s) Index'],
  ['1HZ25V', 'Volatility 25 (1s) Index'],
  ['1HZ15V', 'Volatility 15 (1s) Index'],
  ['1HZ10V', 'Volatility 10 (1s) Index'],
  ['R_100', 'Volatility 100 Index'],
  ['R_75', 'Volatility 75 Index'],
  ['R_50', 'Volatility 50 Index'],
  ['R_25', 'Volatility 25 Index'],
  ['R_10', 'Volatility 10 Index']
];

let publicSocket = null;

function fmt(n) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function digit(n) {
  const s = String(n);
  const m = s.replace(/\D/g, '');
  return m ? Number(m[m.length - 1]) : null;
}

function toast(t) {
  const e = $('toast');
  if (!e) return;
  e.textContent = t;
  e.classList.add('show');
  setTimeout(() => e.classList.remove('show'), 2200);
}

function setConn(t, ok = false) {
  if (!ui.connection) return;
  ui.connection.textContent = '● ' + t;
  ui.connection.style.color = ok ? '#2ce795' : '#ffc857';
}

function analyze() {
  if (state.prices.length < 8) return;

  const p = state.prices.slice(-30);
  const a = p[0];
  const b = p.at(-1);
  const delta = b - a;
  const half = Math.floor(p.length / 2);

  const av1 = p.slice(0, half).reduce((s, v) => s + v, 0) / half;
  const av2 = p.slice(half).reduce((s, v) => s + v, 0) / (p.length - half);

  const bull = delta > 0 && av2 >= av1;
  const bear = delta < 0 && av2 <= av1;

  const dir = bull ? 'OVER' : bear ? 'UNDER' : 'WAIT';
  const conf = Math.min(
    95,
    Math.max(55, Math.round(
      55 + Math.min(40, Math.abs(delta / Math.max(a, 1)) * 100000 * 6)
    ))
  );

  ui.direction.textContent =
    state.contract === 'RISEFALL'
      ? (bull ? 'RISE' : bear ? 'FALL' : 'WAIT')
      : state.contract === 'EVENODD'
        ? 'DIGIT ' + (mostEven() ? 'EVEN' : 'ODD')
        : dir;

  ui.confidence.textContent = conf + '%';
  updateDigits();
  updateAISignalCard();
}

function mostEven() {
  let e = 0, o = 0;
  for (let i = 0; i < 10; i++) {
    if (i % 2) o += state.digits[i];
    else e += state.digits[i];
  }
  return e >= o;
}

function updateDigits() {
  const total = state.digits.reduce((a, b) => a + b, 0);
  if (!total || !ui.grid) return;

  const probs = state.digits.map(n => n / total * 100);
  const hi = probs.indexOf(Math.max(...probs));

  ui.grid.innerHTML = probs.map((v, i) =>
  `<div class="digit ${i === hi ? 'high' : ''}">
    <p>${i}</p>
    <small>${v.toFixed(1)}%</small>
    ${i === hi ? '<span class="digit-cursor"></span>' : ''}
  </div>`
).join('');

  ui.strongest && (ui.strongest.textContent = hi);
  ui.strongestPct && (ui.strongestPct.textContent = '(' + probs[hi].toFixed(1) + '%)');
  ui.digit.textContent = hi;
}

function updateLiveStats() {
  if (ui.tradeCount) ui.tradeCount.textContent = state.tradeCount;
  if (ui.winCount) ui.winCount.textContent = state.winCount;
  if (ui.lossCount) ui.lossCount.textContent = state.lossCount;
  if (ui.profitTotal) {
    const p = Number(state.profitTotal) || 0;
    ui.profitTotal.textContent = (p >= 0 ? '+$' : '-$') + Math.abs(p).toFixed(2);
  }
}

function updateAISignalCard() {
  if (ui.aiReason) {
    const dir = ui.direction?.textContent || 'WAIT';
    ui.aiReason.textContent = dir === 'WAIT'
      ? 'Waiting for a stronger live signal.'
      : 'Based on live tick data and recent digit distribution.';
  }
}


function onTick(t) {
  const q = Number(t.quote);
  if (!Number.isFinite(q)) return;

  state.prices.push(q);
  if (state.prices.length > 120) state.prices.shift();

  const d = digit(q);
  if (d !== null) state.digits[d]++;

  ui.price.textContent = fmt(q);
  ui.digit.textContent = d === null ? '—' : d;
  analyze();
}

function subscribePublic(ws) {
  ws.send(JSON.stringify({
    active_symbols: 'brief',
    product_type: 'basic',
    req_id: 1
  }));

  ws.send(JSON.stringify({
    ticks: state.symbol,
    subscribe: 1,
    req_id: 2
  }));

  ws.send(JSON.stringify({
    ticks_history: state.symbol,
    count: 80,
    end: 'latest',
    style: 'ticks',
    req_id: 3
  }));
}

function populateVolatilities(items) {
  const current = state.symbol;

  const list = (items || [])
    .map(x => ({
      symbol: x.symbol || x.underlying_symbol,
      name: x.display_name || x.underlying_symbol_name || x.symbol
    }))
    .filter(x => x.symbol && /^Volatility\s/i.test(x.name));

  const merged = new Map();
  fallbackVolatilities.forEach(([symbol, name]) =>
    merged.set(symbol, { symbol, name })
  );
  list.forEach(x => merged.set(x.symbol, x));

  const sorted = [...merged.values()].sort((a, b) => {
    const a1 = /\(1s\)/i.test(a.name);
    const b1 = /\(1s\)/i.test(b.name);
    if (a1 !== b1) return a1 ? -1 : 1;

    const na = Number((a.name.match(/Volatility\s+(\d+)/i) || [])[1] || 999);
    const nb = Number((b.name.match(/Volatility\s+(\d+)/i) || [])[1] || 999);
    return na - nb;
  });

  marketSelect.innerHTML = sorted
    .map(x => `<option value="${x.symbol}">${x.name}</option>`)
    .join('');

  marketSelect.value = sorted.some(x => x.symbol === current)
    ? current
    : state.symbol;
}

function connectPublic() {
  try { publicSocket?.close(); } catch (_) {}

  setConn('Connecting…');
  const ws = new WebSocket(publicFeed);
  publicSocket = ws;
  let opened = false;

  ws.onopen = () => {
    opened = true;
    setConn('Live market connected', true);
    subscribePublic(ws);
  };

  ws.onmessage = e => {
    try {
      const d = JSON.parse(e.data);

      if (d.msg_type === 'active_symbols' && Array.isArray(d.active_symbols)) {
        populateVolatilities(d.active_symbols);
      }

      if (d.msg_type === 'history' && d.history?.prices) {
        state.prices = d.history.prices
          .map(Number)
          .filter(Number.isFinite)
          .slice(-120);

        state.digits = Array(10).fill(0);
        state.prices.forEach(v => {
          const z = digit(v);
          if (z !== null) state.digits[z]++;
        });
        analyze();
      }

      if (d.msg_type === 'tick' && d.tick) onTick(d.tick);
    } catch (_) {}
  };

  ws.onerror = () => {
    if (!opened) setConn('Connection error');
  };

  ws.onclose = () => {
    setConn('Reconnecting…');
    clearTimeout(state.reconnect);
    state.reconnect = setTimeout(connectPublic, 3000);
  };
}

/* ---------- OAuth ---------- */

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sha256Base64Url(text) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return base64Url(new Uint8Array(hash));
}

function randomString(len = 64) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, v => chars[v % chars.length]).join('');
}

function randomState() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, v => v.toString(16).padStart(2, '0')).join('');
}

async function startDerivOAuth() {
  const verifier = randomString(64);
  const stateValue = randomState();

  sessionStorage.setItem('pkce_code_verifier', verifier);
  sessionStorage.setItem('oauth_state', stateValue);

  const challenge = await sha256Base64Url(verifier);

  const u = new URL('https://auth.deriv.com/oauth2/auth');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', DERIV_CLIENT_ID);
  u.searchParams.set('redirect_uri', DERIV_REDIRECT_URI);
  u.searchParams.set('scope', 'trade');
  u.searchParams.set('state', stateValue);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');

  window.location.href = u.toString();
}

async function finishDerivOAuth() {
  const q = new URLSearchParams(location.search);
  const code = q.get('code');
  const returnedState = q.get('state');

  if (!code) return;

  if (returnedState !== sessionStorage.getItem('oauth_state')) {
    toast('Deriv login verification failed.');
    return;
  }

  const verifier = sessionStorage.getItem('pkce_code_verifier');

  try {
    const r = await fetch('/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        redirect_uri: DERIV_REDIRECT_URI,
        client_id: DERIV_CLIENT_ID
      })
    });

    const data = await r.json();

    if (!r.ok || !data.access_token) {
      throw new Error(data.error || 'Token exchange failed');
    }

    auth.token = data.access_token;
    sessionStorage.setItem('deriv_access_token', auth.token);
    sessionStorage.removeItem('pkce_code_verifier');
    sessionStorage.removeItem('oauth_state');

    history.replaceState({}, '', location.pathname);
    await loadDerivAccounts();
  } catch (e) {
    console.error(e);
    toast('Deriv connection failed.');
  }
}

/* ---------- Deriv accounts ---------- */

async function loadDerivAccounts() {
  if (!auth.token) return;

  try {
    const r = await fetch(
      DERIV_API + '/trading/v1/options/accounts',
      { headers: { Authorization: 'Bearer ' + auth.token } }
    );

    const data = await r.json();

    if (!r.ok) {
      throw new Error(data?.errors?.[0]?.message || 'Account lookup failed');
    }

    const raw = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.data?.accounts)
        ? data.data.accounts
        : [];

    const accounts = raw.filter(a => a?.account_id);

    if (!accounts.length) {
      throw new Error('No Deriv Options account found.');
    }

    // Prefer demo by default.
    const demo = accounts.find(a =>
      String(a.account_type || a.type || '').toLowerCase() === 'demo'
    );

    const real = accounts.find(a =>
      String(a.account_type || a.type || '').toLowerCase() === 'real'
    );

    sessionStorage.setItem(
      'deriv_accounts',
      JSON.stringify({
        demo: demo || null,
        real: real || null
      })
    );

    if (ui.accountType && real) {
      ui.accountType.value =
        sessionStorage.getItem('deriv_account_type') === 'real'
          ? 'real'
          : 'demo';
    }

    await connectSelectedAccount(false);
  } catch (e) {
    console.error(e);
    toast(e.message || 'Could not load Deriv accounts.');
  }
}

function getSavedAccounts() {
  try {
    return JSON.parse(sessionStorage.getItem('deriv_accounts') || '{}');
  } catch (_) {
    return {};
  }
}

function selectedAccount() {
  const accounts = getSavedAccounts();
  return accounts[state.accountType] || null;
}

async function connectSelectedAccount(showToast = true) {
  const account = selectedAccount();

  if (!auth.token) {
    if (showToast) toast('Connect Deriv first.');
    return;
  }

  if (!account) {
    if (state.accountType === 'real') {
      toast('No real Options account is available.');
    } else {
      toast('No demo Options account is available.');
    }
    return;
  }

  state.accountId = account.account_id;
  state.currency = account.currency || 'USD';

  sessionStorage.setItem('deriv_account_id', state.accountId);
  sessionStorage.setItem('deriv_account_type', state.accountType);

  await openAuthenticatedWebSocketForAccount(state.accountId, state.accountType);

  if (showToast) {
    toast(
      state.accountType === 'real'
        ? 'REAL account connected.'
        : 'Demo account connected.'
    );
  }
}

async function openAuthenticatedWebSocketForAccount(accountId, accountType) {
  try { state.ws?.close(); } catch (_) {}

  setConn('Authorizing…');

  const otp = await fetch(
    DERIV_API +
    '/trading/v1/options/accounts/' +
    encodeURIComponent(accountId) +
    '/otp',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + auth.token
      }
    }
  );

  const od = await otp.json();

  if (!otp.ok || !od.data?.url) {
    throw new Error(
      od?.errors?.[0]?.message || 'Could not create Deriv session'
    );
  }

  const ws = new WebSocket(od.data.url);
  state.ws = ws;
  state.authenticated = false;

  ws.onopen = () => {
    state.authenticated = true;

    const label = accountType === 'real'
      ? 'Deriv REAL connected'
      : 'Deriv DEMO connected';

    setConn(label, true);

    if (ui.connect) {
      ui.connect.textContent = 'Deriv Connected';
      ui.connect.classList.add('connected');
    }

    if (ui.accountLabel) {
      ui.accountLabel.textContent =
        accountType === 'real' ? 'Real Account' : 'Demo Account';
    }

    // Keep balance synced from Deriv.
    ws.send(JSON.stringify({
      balance: 1,
      subscribe: 1,
      req_id: 500
    }));

    ws.send(JSON.stringify({
      ticks: state.symbol,
      subscribe: 1,
      req_id: 501
    }));
  };

  ws.onmessage = e => {
    try {
      const d = JSON.parse(e.data);

      if (d.error) {
        console.error('Deriv error:', d);
        if (d.req_id === state.proposalReqId) {
          state.waitingForProposal = null;
          toast(d.error.message || 'Proposal failed.');
        }
        if (d.req_id === state.buyReqId) {
          state.waitingForProposal = null;
          toast(d.error.message || 'Trade was not placed.');
        }
        return;
      }

      if (d.msg_type === 'balance' && d.balance) {
        const b = Number(d.balance.balance);
        if (Number.isFinite(b)) {
          state.balance = b;
          ui.balance.textContent = '$' + b.toFixed(2);
        }
      }

      if (d.msg_type === 'tick' && d.tick) {
        onTick(d.tick);
      }

      if (d.msg_type === 'proposal' && d.req_id === state.proposalReqId) {
        handleProposal(d);
      }

      if (d.msg_type === 'buy' && d.req_id === state.buyReqId) {
        handleBuy(d);
      }

      if (
        d.msg_type === 'proposal_open_contract' &&
        d.req_id === state.contractReqId
      ) {
        handleContractUpdate(d);
      }
    } catch (_) {}
  };

  ws.onerror = () => {
    setConn('Deriv connection error');
  };

  ws.onclose = () => {
    state.authenticated = false;
    if (ui.connect) {
      ui.connect.textContent = 'Connect Deriv';
      ui.connect.classList.remove('connected');
    }
    setConn('Deriv disconnected');
  };
}

/* ---------- Real/demo trading ---------- */

function contractRequest(side) {
  if (state.contract === 'OVERUNDER') {
    return {
      contract_type: side === 'left' ? 'DIGITOVER' : 'DIGITUNDER',
      barrier: side === 'left' ? '3' : '4'
    };
  }

  if (state.contract === 'EVENODD') {
    return {
      contract_type: side === 'left' ? 'DIGITEVEN' : 'DIGITODD'
    };
  }

  // For Rise/Fall, use CALL/PUT.
  return {
    contract_type: side === 'left' ? 'CALL' : 'PUT'
  };
}

function placeDerivTrade(side) {
  if (!auth.token || !state.ws || !state.authenticated) {
    toast('Connect Deriv before trading.');
    return;
  }

  if (state.waitingForProposal) {
    toast('Please wait for the previous trade request.');
    return;
  }

  const account = selectedAccount();
  if (!account) {
    toast('Selected Deriv account is unavailable.');
    return;
  }

  const stake = Number(state.stake);

  if (!Number.isFinite(stake) || stake <= 0) {
    toast('Enter a valid stake.');
    return;
  }

  if (Number.isFinite(state.balance) && state.balance < stake) {
    toast('Insufficient Deriv balance.');
    return;
  }

  const c = contractRequest(side);

  state.proposalReqId++;
  state.waitingForProposal = {
    side,
    stake,
    symbol: state.symbol,
    contractType: c.contract_type
  };

  const request = {
    proposal: 1,
    amount: stake,
    basis: 'stake',
    contract_type: c.contract_type,
    currency: state.currency || 'USD',
    duration: 1,
    duration_unit: 't',
    underlying_symbol: state.symbol,
    req_id: state.proposalReqId
  };

  if (c.barrier !== undefined) {
    request.barrier = c.barrier;
  }

  state.ws.send(JSON.stringify(request));

  document.querySelectorAll('.trade')
    .forEach(b => b.classList.remove('selected'));

  $(side === 'left' ? 'over' : 'under')
    ?.classList.add('selected');

  toast(
    (state.accountType === 'real' ? 'REAL ' : 'DEMO ') +
    side.toUpperCase() +
    ' proposal requested…'
  );
}

function handleProposal(d) {
  const p = d.proposal;
  const pending = state.waitingForProposal;

  if (!p || !pending) return;

  const proposalId = p.id;
  const ask = Number(p.ask_price);

  if (!proposalId || !Number.isFinite(ask)) {
    state.waitingForProposal = null;
    toast('Deriv returned an invalid proposal.');
    return;
  }

  ui.payout.textContent = '$' +
    Number(p.payout ?? (ask * 1.95)).toFixed(2);

  state.buyReqId++;

  state.ws.send(JSON.stringify({
    buy: String(proposalId),
    price: ask,
    req_id: state.buyReqId
  }));
}

function handleBuy(d) {
  const pending = state.waitingForProposal;
  if (!pending || !d.buy?.contract_id) {
    state.waitingForProposal = null;
    return;
  }

  const contractId = d.buy.contract_id;
  const buyPrice = Number(
    d.buy.buy_price ?? pending.stake
  );

  state.ws.send(JSON.stringify({
    proposal_open_contract: 1,
    contract_id: contractId,
    subscribe: 1,
    req_id: ++state.contractReqId
  }));

  ui.payout.textContent = '$' +
    Number(d.buy.payout ?? 0).toFixed(2);

  toast(
    (state.accountType === 'real' ? 'REAL ' : 'DEMO ') +
    'trade placed. Contract #' + contractId
  );

  state.waitingForProposal = {
    ...pending,
    contractId,
    buyPrice
  };
}

function handleContractUpdate(d) {
  const t = state.waitingForProposal;
  const c = d.proposal_open_contract;

  if (!t || !c) return;

  const isClosed =
    c.is_sold === 1 ||
    c.status === 'sold' ||
    c.status === 'expired';

  if (!isClosed) return;

  const profit = Number(c.profit || 0);
  const won = profit > 0 || String(c.status).toLowerCase() === 'won' || Number(c.status) === 1;

  state.tradeCount++;
  state.profitTotal += Number.isFinite(profit) ? profit : 0;
  if (won) state.winCount++;
  else state.lossCount++;
  updateLiveStats();

  if (won) {
    toast(
      (state.accountType === 'real' ? 'REAL ' : 'DEMO ') +
      'WIN — Profit $' + profit.toFixed(2)
    );
  } else {
    toast(
      (state.accountType === 'real' ? 'REAL ' : 'DEMO ') +
      'LOSS — $' + Math.abs(profit).toFixed(2)
    );
  }

  state.waitingForProposal = null;
}

/* ---------- UI ---------- */

function setStake(v) {
  state.stake = Math.max(1, Math.min(100, Number(v) || 1));
  ui.stake.textContent = state.stake;
  ui.payout.textContent = '$' + (state.stake * 1.96).toFixed(2);
}

document.querySelectorAll('.contract').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.contract')
      .forEach(x => x.classList.remove('active'));

    b.classList.add('active');
    state.contract = b.dataset.contract;
    updateTradeLabels();
    analyze();
  };
});

function updateTradeLabels() {
  const l = $('leftTradeLabel');
  const r = $('rightTradeLabel');
  const lr = $('leftRule');
  const rr = $('rightRule');

  if (state.contract === 'RISEFALL') {
    l.textContent = 'RISE';
    r.textContent = 'FALL';
    lr.textContent = 'Price goes up';
    rr.textContent = 'Price goes down';
  } else if (state.contract === 'EVENODD') {
    l.textContent = 'EVEN';
    r.textContent = 'ODD';
    lr.textContent = '0, 2, 4, 6, 8';
    rr.textContent = '1, 3, 5, 7, 9';
  } else {
    l.textContent = 'OVER';
    r.textContent = 'UNDER';
    lr.textContent = 'Digits 4 - 9';
    rr.textContent = 'Digits 0 - 3';
  }
}

marketSelect.onchange = e => {
  state.symbol = e.target.value;
  state.prices = [];
  state.digits = Array(10).fill(0);

  try { state.ws?.close(); } catch (_) {}
  try { publicSocket?.close(); } catch (_) {}

  connectPublic();

  if (auth.token) {
    loadDerivAccounts().catch(() => {});
  }
};

document.querySelectorAll('[data-delta]').forEach(b =>
  b.onclick = () => setStake(state.stake + Number(b.dataset.delta))
);

document.querySelectorAll('[data-stake]').forEach(b =>
  b.onclick = () => setStake(Number(b.dataset.stake))
);

// Existing center button follows the AI direction.
$('place').onclick = () => {
  if (!state.autoMode) {
    toast('MANUAL mode: choose OVER/UNDER, EVEN/ODD, or RISE/FALL.');
    return;
  }
  const signal = ui.direction.textContent;

  if (signal === 'OVER' || signal === 'RISE' || signal === 'EVEN') {
    placeDerivTrade('left');
  } else if (signal === 'UNDER' || signal === 'FALL' || signal === 'ODD') {
    placeDerivTrade('right');
  } else {
    toast('AI says WAIT — no trade placed.');
  }
};

// Direct buttons place trades immediately when clicked.
$('over').onclick = () => placeDerivTrade('left');
$('under').onclick = () => placeDerivTrade('right');

$('reset').onclick = () => {
  if (state.accountType === 'real') {
    toast('Real balance cannot be reset from FXTRADE.');
    return;
  }

  if (auth.token && state.accountId) {
    toast('Demo balance is managed by Deriv.');
    return;
  }

  state.balance = 10000;
  ui.balance.textContent = '$10,000.00';
};

$('analyze').onclick = () => {
  analyze();
  toast('Analysis refreshed.');
};

// AUTO / MANUAL mode controls. AUTO means the AI TRADE button can follow the current signal;
// MANUAL keeps the directional buttons available without auto-triggering a trade.
$('autoMode')?.addEventListener('click', () => {
  state.autoMode = true;
  $('autoMode')?.classList.add('active');
  $('manualMode')?.classList.remove('active');
  toast('AUTO mode selected.');
});
$('manualMode')?.addEventListener('click', () => {
  state.autoMode = false;
  $('manualMode')?.classList.add('active');
  $('autoMode')?.classList.remove('active');
  toast('MANUAL mode selected.');
});

document.querySelectorAll('.nav-item').forEach((b, i) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    if (i === 1) toast('AI panel selected.');
    if (i === 2) toast('Positions are shown from completed Deriv contracts.');
  });
});

updateLiveStats();


if (ui.connect) {
  ui.connect.onclick = () => {
    if (auth.token) loadDerivAccounts();
    else startDerivOAuth();
  };
}

if (ui.accountType) {
  ui.accountType.onchange = async e => {
    state.accountType = e.target.value === 'real' ? 'real' : 'demo';
    sessionStorage.setItem('deriv_account_type', state.accountType);

    if (!auth.token) {
      toast('Connect Deriv first.');
      ui.accountType.value = 'demo';
      state.accountType = 'demo';
      return;
    }

    await connectSelectedAccount(true);
  };
}

setStake(5);
updateTradeLabels();
connectPublic();
finishDerivOAuth().then(() => {
  if (auth.token) loadDerivAccounts().catch(() => {});
});
})();
