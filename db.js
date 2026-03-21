import { supabase } from './supabase-config.js'

// GET all subscriptions for logged in user
export async function getSubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('day', { ascending: true })

  if (error) { console.error(error); return [] }
  return data
}

// ADD a subscription
export async function addSubscriptionDB(sub) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: user.id,
      name: sub.name,
      price: sub.price,
      day: sub.day,
      alert_days: sub.alertDays,
      icon_url: sub.iconUrl
    })
    .select()
    .single()

  if (error) { console.error(error); return null }
  return data
}

// DELETE a subscription
export async function deleteSubscriptionDB(id) {
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id)

  if (error) console.error(error)
}