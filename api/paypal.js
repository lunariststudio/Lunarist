export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { amount, service } = req.body;
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
            description: service,
            amount: {
              currency_code: 'USD',
              value: amount,
            },
          },
        ],
      }),
    });

    const orderData = await orderResponse.json();
    return res.status(200).json(orderData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}