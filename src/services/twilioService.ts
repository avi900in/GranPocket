export const sendSms = async (to: string, body: string) => {
  const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  const fromNumber = import.meta.env.VITE_TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio credentials not configured in environment variables.');
    return { success: false, error: 'Credentials not configured' };
  }

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
