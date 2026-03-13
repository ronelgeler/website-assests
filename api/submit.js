const crypto = require('crypto');

// Helper function to hash data for Facebook (SHA256)
function hashData(data) {
  if (!data) return null;
  let cleanData = data.toString().toLowerCase().trim();
  
  // For phone numbers, remove non-digits and add country code
  if (/^\d+$/.test(cleanData.replace(/\D/g, ''))) {
    cleanData = cleanData.replace(/\D/g, '');
    if (cleanData.startsWith('0')) {
      cleanData = '972' + cleanData.substring(1);
    }
  }
  
  return crypto.createHash('sha256').update(cleanData).digest('hex');
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const { Name, Phone } = body || {};

  if (!Name || !Phone) {
    return res.status(400).json({ error: 'Missing Name or Phone' });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const PIXEL_ID = process.env.FB_PIXEL_ID || '3843866865916899'; 
  const FB_TOKEN = process.env.FB_ACCESS_TOKEN || 'EAAUvFuURnkEBQ9FhZA8vPjp6i5xfrGYGV5WGdzZBacdnoOyEVLS5vpNH6k7ZCZAtPMGd7gPMyPBo8qObUOqhRvUQUYN1Xm6f2xxcQzbSi7KTKIcrCuXY87pv4R8QZBHL39QNsKZBVOYK82IkxLlhX5iyWuZABWZCzfCd9mZAgdobi98AXdMaS3gDv1ibk5NlsBwZDZD';

  let debugInfo = { brevo: null, facebook: null };

  // 1. BREVO EMAIL
  if (BREVO_API_KEY) {
    const brevoData = {
      sender: { name: "Ronel Geler Website", email: "ronelgeler@gmail.com" },
      to: [{ email: "ronelgeler@gmail.com", name: "רונאל גלר" }],
      subject: `ליד חדש מהאתר: ${Name}`,
      htmlContent: `<div dir="rtl"><h2>התקבלה פנייה חדשה!</h2><p><strong>שם:</strong> ${Name}</p><p><strong>טלפון:</strong> ${Phone}</p></div>`
    };

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify(brevoData)
      });
      const result = await response.json();
      debugInfo.brevo = { status: response.status, ok: response.ok, result };
    } catch (e) {
      debugInfo.brevo = { error: e.message };
    }
  } else {
    debugInfo.brevo = "API Key Missing";
  }

  // 2. FACEBOOK CONVERSIONS
  const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
  const clientUserAgent = req.headers['user-agent'];

  const fbPayload = {
    data: [{
      event_name: "Lead",
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data: {
        ph: [hashData(Phone)],
        fn: [hashData(Name.split(' ')[0])],
        client_ip_address: clientIp,
        client_user_agent: clientUserAgent
      }
    }]
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${FB_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fbPayload)
    });
    const result = await response.json();
    debugInfo.facebook = { status: response.status, ok: response.ok, result };
  } catch (e) {
    debugInfo.facebook = { error: e.message };
  }

  // Return status 200 with debug info so you can see it in the Browser Console
  return res.status(200).json({ success: true, debug: debugInfo });
};
