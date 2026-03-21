import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!
  )

  // Get all users
  const {
    data: { users },
    error: usersError
  } = await supabase.auth.admin.listUsers()
  if (usersError) return new Response(`Error: ${usersError.message}`, { status: 500 })

  // Get previous month name
  const now = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const month = prevMonth.toLocaleString('en-NG', { month: 'long', year: 'numeric' })

  let emailsSent = 0

  for (const user of users) {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)

    if (!subs || subs.length === 0) continue

    const userName = user.user_metadata?.full_name || 'there'
    const userEmail = user.email
    if (!userEmail) continue

    const totalMonthly = subs.reduce((acc, s) => acc + Number(s.price), 0)
    const highest = subs.reduce((best, s) =>
      Number(s.price) > Number(best.price) ? s : best, subs[0]
    )

    const subRows = subs
      .sort((a, b) => Number(b.price) - Number(a.price))
      .map((s) => `
        <tr>
          <td style="padding:12px 16px; border-bottom:1px solid #e5e7eb; font-size:14px; color:#111111; font-weight:600;">${s.name}</td>
          <td style="padding:12px 16px; border-bottom:1px solid #e5e7eb; font-size:14px; color:#111111; font-weight:600;">&#8358;${Number(s.price).toLocaleString('en-NG')}</td>
          <td style="padding:12px 16px; border-bottom:1px solid #e5e7eb; font-size:13px; color:#6b7280;">Renews on day ${s.day}</td>
        </tr>
      `)
      .join('')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'SubSync <onboarding@resend.dev>',
        to: userEmail,
        subject: `Your SubSync Monthly Review - ${month}`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding:32px 0;">
    <tr>
      <td align="center" style="padding:0 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%; max-width:560px; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#111111; border-bottom:1px solid #1f2937; padding:28px 32px;">
              <p style="margin:0 0 6px; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#9ca3af;">SubSync</p>
              <h1 style="margin:0; font-size:28px; line-height:1.2; color:#ffffff; font-weight:700;">Monthly Review</h1>
              <p style="margin:8px 0 0; font-size:14px; color:#d1d5db;">Summary for ${month}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px; font-size:16px; line-height:1.5; color:#1a1a1a;">Hi <strong>${userName}</strong>,</p>
              <p style="margin:0 0 24px; font-size:14px; line-height:1.65; color:#6b7280;">
                Here is your subscription summary for ${month}. This includes your total spend, active subscriptions, and biggest recurring cost.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td width="32%" style="background:#fafafa; border:1px solid #e5e7eb; border-radius:12px; text-align:center; padding:16px 8px;">
                    <p style="margin:0 0 6px; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#9ca3af;">Monthly Spend</p>
                    <p style="margin:0; font-size:18px; color:#111111; font-weight:700;">&#8358;${totalMonthly.toLocaleString('en-NG')}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="32%" style="background:#fafafa; border:1px solid #e5e7eb; border-radius:12px; text-align:center; padding:16px 8px;">
                    <p style="margin:0 0 6px; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#9ca3af;">Subscriptions</p>
                    <p style="margin:0; font-size:18px; color:#111111; font-weight:700;">${subs.length}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="32%" style="background:#fafafa; border:1px solid #e5e7eb; border-radius:12px; text-align:center; padding:16px 8px;">
                    <p style="margin:0 0 6px; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#9ca3af;">Annual Cost</p>
                    <p style="margin:0; font-size:18px; color:#111111; font-weight:700;">&#8358;${(totalMonthly * 12).toLocaleString('en-NG')}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; margin-bottom:22px;">
                <tr>
                  <td style="padding:13px 16px; font-size:13px; line-height:1.5; color:#374151;">
                    <strong>Highest subscription:</strong> ${highest.name} at &#8358;${Number(highest.price).toLocaleString('en-NG')}/month.
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 10px; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9ca3af;">Your Subscriptions</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; margin-bottom:24px;">
                <tr style="background:#fafafa;">
                  <th style="padding:10px 16px; text-align:left; font-size:11px; color:#9ca3af; font-weight:600; letter-spacing:0.08em; text-transform:uppercase;">Service</th>
                  <th style="padding:10px 16px; text-align:left; font-size:11px; color:#9ca3af; font-weight:600; letter-spacing:0.08em; text-transform:uppercase;">Amount</th>
                  <th style="padding:10px 16px; text-align:left; font-size:11px; color:#9ca3af; font-weight:600; letter-spacing:0.08em; text-transform:uppercase;">Billing</th>
                </tr>
                ${subRows}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="http://127.0.0.1:5502" style="display:inline-block; background:#111111; border:1px solid #111111; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600; padding:12px 26px; border-radius:10px;">
                      View Full Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa; border-top:1px solid #e5e7eb; padding:22px 32px; text-align:center;">
              <p style="margin:0; font-size:12px; line-height:1.55; color:#9ca3af;">
                You are receiving this because you have an active SubSync account.<br>
                &copy; 2026 SubSync. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      })
    })

    const resJson = await res.json()
    console.log('Resend response:', JSON.stringify(resJson))
    emailsSent++
  }

  return new Response(`Sent ${emailsSent} monthly summary emails`, { status: 200 })
})
