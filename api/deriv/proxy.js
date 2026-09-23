export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { path, method = 'GET', body, token } = req.body || {};

    if (!token || !path || !path.startsWith('/trading/v1/options/')) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const url = 'https://api.derivws.com' + path;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(body || {})
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || 'Deriv API error' };
    }

    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({
      error: 'Deriv API proxy failed'
    });
  }
}
