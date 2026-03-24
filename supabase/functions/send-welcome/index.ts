import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const { email, name } = await req.json()

  if (!email) return new Response('No email provided', { status: 400 })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'SubSync <onboarding@resend.dev>',
      to: email,
      subject: 'Welcome to SubSync!',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        
        <tr>
          <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:700;">👋 Welcome to SubSync!</h1>
            <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Your subscription tracker is ready</p>
          </td>
        </tr>

        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#374151;">Hi <strong>${name || 'there'}</strong>! 🎉</p>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.7;">
              You've successfully signed up for SubSync. Track all your subscriptions in one place and never get caught off guard by a renewal again.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:28px;">
              <tr><td style="padding:24px;">
                <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">What you get</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:8px 0;font-size:14px;color:#4b5563;">📅 &nbsp; Track all your subscriptions in one place</td></tr>
                  <tr><td style="padding:8px 0;font-size:14px;color:#4b5563;">🔔 &nbsp; Reminder emails 1, 2 & 3 days before renewal</td></tr>
                  <tr><td style="padding:8px 0;font-size:14px;color:#4b5563;">📊 &nbsp; Monthly spend overview every 1st of the month</td></tr>
                  <tr><td style="padding:8px 0;font-size:14px;color:#4b5563;">💰 &nbsp; See exactly where your money goes</td></tr>
                </table>
              </td></tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="http://127.0.0.1:5502" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;">
                  Start Tracking →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              You're receiving this because you just signed up for SubSync.<br>
              © 2026 SubSync. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
      `
    })
  })

  const result = await res.json()
  console.log('Welcome email:', JSON.stringify(result))
  return new Response(JSON.stringify({ success: true }), { status: 200 })
})