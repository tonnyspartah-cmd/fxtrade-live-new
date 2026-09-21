export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { code, code_verifier, redirect_uri, client_id } = body;

    if (!code || !code_verifier || !redirect_uri || !client_id) {
      return res.status(400).json({ error: 'Missing OAuth parameters' });
    }

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id,
      code,
      code_verifier,
      redirect_uri
    });

    const r = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text || 'Token exchange failed' }; }

    return res.status(r.status).json(data);
  } catch (err) {
    console.error('Deriv OAuth token exchange error:', err);
    return res.status(500).json({ error: 'Server error during Deriv login' });
  }
}
