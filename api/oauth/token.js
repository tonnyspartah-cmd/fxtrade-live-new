
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      code,
      code_verifier,
      redirect_uri,
      client_id
    } = req.body || {};

    if (!code || !code_verifier || !redirect_uri || !client_id) {
      return res.status(400).json({
        error: 'Missing OAuth parameters'
      });
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id,
      code,
      code_verifier,
      redirect_uri
    });

    const response = await fetch(
      'https://auth.deriv.com/oauth2/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = {
        error: text || 'Invalid response from Deriv'
      };
    }

    return res.status(response.status).json(data);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'OAuth token exchange failed'
    });
  }
}
