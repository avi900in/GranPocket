export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Support both JSON and URL-encoded bodies
  const { to, body } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio credentials are not configured on the server.' });
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const data = new URLSearchParams();
  data.append('To', to);
  data.append('From', fromNumber);
  data.append('Body', body);

  const headers = new Headers();
  headers.append('Authorization', 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64'));
  headers.append('Content-Type', 'application/x-www-form-urlencoded');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: data,
    });
    const result = await response.json();
    if (response.ok) {
      return res.status(200).json({ success: true, data: result });
    } else {
      return res.status(400).json({ success: false, error: result.message });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
}
