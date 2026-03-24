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
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('Unable to resolve authenticated user:', userError)
    return null
  }

  const basePayload = {
    user_id: user.id,
    name: sub.name,
    price: sub.price,
    day: sub.day,
    alert_days: sub.alertDays,
    icon_url: sub.iconUrl
  }

  const extendedPayload = {
    ...basePayload,
    cycle: sub.cycle || 'monthly',
    category: sub.category || 'other'
  }

  let { data, error } = await supabase
    .from('subscriptions')
    .insert(extendedPayload)
    .select()
    .single()

  // Backward-compat fallback if DB doesn't have cycle/category columns yet.
  if (error && /cycle|category/i.test(error.message || '')) {
    const retry = await supabase
      .from('subscriptions')
      .insert(basePayload)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) { console.error('addSubscriptionDB failed:', error); return null }
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
