export const sendSms = async (to: string, body: string) => {
  const env = (import.meta as any).env || {};
  const accountSid = env.VITE_TWILIO_ACCOUNT_SID;
  const authToken = env.VITE_TWILIO_AUTH_TOKEN;
  const fromNumber = env.VITE_TWILIO_FROM_NUMBER;

  // If VITE_ variables are missing (e.g. in Vercel production), use the secure backend proxy
  if (!accountSid || !authToken || !fromNumber) {
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body }),
      });
      const result = await response.json();
      return { success: response.ok, ...result };
    } catch (error) {
      console.error('Failed to call /api/send-sms endpoint:', error);
      return { success: false, error: 'Failed to trigger backend SMS' };
    }
  }

  // Fallback: Local development direct client-side fetch (Insecure, but works for dev testing)
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const data = new URLSearchParams();
  data.append('To', to);
  data.append('From', fromNumber);
  data.append('Body', body);

  const headers = new Headers();
  headers.append('Authorization', 'Basic ' + btoa(accountSid + ':' + authToken));
  headers.append('Content-Type', 'application/x-www-form-urlencoded');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: data,
    });
    const result = await response.json();
    if (response.ok) {
      return { success: true, data: result };
    } else {
      console.error('Twilio Error:', result);
      return { success: false, error: result.message };
    }
  } catch (error) {
    console.error('Twilio Exception:', error);
    return { success: false, error: String(error) };
  }
};
