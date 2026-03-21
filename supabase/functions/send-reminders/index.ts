import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  console.log("URL:", url);
  console.log("Service key exists:", !!key);
  console.log("Resend key exists:", !!resendKey);

  const supabase = createClient(url!, key);

  const today = new Date();
  const todayDay = today.getDate();

  // Get all subscriptions
  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("*");

  if (error) return new Response(`DB Error: ${error.message}`, { status: 500 });

  let emailsSent = 0;

  for (const sub of subs ?? []) {
    const daysUntil = sub.day - todayDay;
    if (daysUntil !== 3 && daysUntil !== 2 && daysUntil !== 1) continue;

    // Get user email
    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(sub.user_id);
    if (userError || !userData?.user?.email) continue;

    const userEmail = userData.user.email;
    const userName = userData.user.user_metadata?.full_name || "there";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SubSync <onboarding@resend.dev>",
        to: userEmail,
        subject: `Reminder: ${sub.name} renews in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
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
              <h1 style="margin:0; font-size:28px; line-height:1.2; color:#ffffff; font-weight:700;">Subscription Reminder</h1>
              <p style="margin:8px 0 0; font-size:14px; color:#d1d5db;">A heads-up before your next renewal.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px; font-size:16px; line-height:1.5; color:#1a1a1a;">Hi <strong>${userName}</strong>,</p>
              <p style="margin:0 0 24px; font-size:14px; line-height:1.65; color:#6b7280;">
                Your subscription is renewing soon. Here is your upcoming charge summary.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa; border:1px solid #e5e7eb; border-radius:12px; margin-bottom:20px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 6px; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9ca3af;">Service</p>
                    <p style="margin:0 0 16px; font-size:22px; line-height:1.25; color:#111111; font-weight:700;">${sub.name}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb; padding-top:14px;">
                      <tr>
                        <td width="50%" style="padding-top:14px; vertical-align:top;">
                          <p style="margin:0 0 6px; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9ca3af;">Amount</p>
                          <p style="margin:0; font-size:18px; color:#111111; font-weight:600;">&#8358;${Number(sub.price).toLocaleString("en-NG")}</p>
                        </td>
                        <td width="50%" style="padding-top:14px; vertical-align:top;">
                          <p style="margin:0 0 6px; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:#9ca3af;">Renews In</p>
                          <p style="margin:0; font-size:18px; color:#111111; font-weight:600;">${daysUntil} day${daysUntil === 1 ? "" : "s"}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${
                daysUntil === 1
                  ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; margin-bottom:24px;">
                <tr>
                  <td style="padding:13px 16px; font-size:13px; line-height:1.5; color:#b91c1c;">
                    <strong>Renewing tomorrow.</strong> Confirm your payment method is ready.
                  </td>
                </tr>
              </table>`
                  : `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; margin-bottom:24px;">
                <tr>
                  <td style="padding:13px 16px; font-size:13px; line-height:1.5; color:#374151;">
                    <strong>${daysUntil} day${daysUntil === 1 ? "" : "s"} left.</strong> Review this subscription before it renews.
                  </td>
                </tr>
              </table>`
              }
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="http://127.0.0.1:5502" style="display:inline-block; background:#111111; border:1px solid #111111; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600; padding:12px 26px; border-radius:10px;">
                      Manage Subscriptions
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
        `,
      }),
    });

    const resJson = await res.json();
    console.log("Resend response:", JSON.stringify(resJson));
    emailsSent++;
  }

  return new Response(`Sent ${emailsSent} reminder emails`, { status: 200 });
});
