// Server-side price catalog. The amount charged is ALWAYS looked up from here —
// never taken from the client — so a request can't be replayed with a lower
// (or zero) amount. Fill in your real service keys and prices before going live.
const SERVICES = {
  // 'commission-sketch': { amount: '25.00', label: 'Sketch Commission' },
  // 'commission-illustration': { amount: '75.00', label: 'Illustration Commission' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { service } = req.body || {};
  const entry = typeof service === 'string' ? SERVICES[service] : null;
  if (!entry) {
    return res.status(400).json({ error: 'Unknown or unconfigured service' });
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secretKey = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secretKey) {
    return res.status(500).json({ error: 'PayPal credentials not configured in environment variables.' });
  }

  try {
    const auth = Buffer.from(`${clientId}:${secretKey}`).toString('base64');
    const tokenResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      body: 'grant_type=client_credentials',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(502).json({ error: 'Unable to authenticate with PayPal' });
    }

    const orderResponse = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            description: entry.label,
            amount: {
              currency_code: 'USD',
              value: entry.amount,
            },
          },
        ],
      }),
    });

    const orderData = await orderResponse.json();
    return res.status(orderResponse.status).json(orderData);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'PayPal request failed' });
  }
}
