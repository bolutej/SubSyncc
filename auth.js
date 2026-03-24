import { supabase } from './supabase-config.js'
import { getSubscriptions, addSubscriptionDB, deleteSubscriptionDB } from './db.js'

// Make db functions available to script.js
window.dbFunctions = { getSubscriptions, addSubscriptionDB, deleteSubscriptionDB }
const currentPage = window.location.pathname

// ─── RUNS ON LOGIN PAGE ───────────────────────────────────────
if (currentPage.includes('index') || currentPage === '/') {

  // Listen for auth changes — this fires when Google redirects back
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      const user = session.user

      // Only send welcome email to brand new users
      const isNewUser = user.created_at === user.last_sign_in_at

      if (isNewUser) {
        try {
          await fetch('https://kehustpdddxrdnnxndbj.supabase.co/functions/v1/send-welcome', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlaHVzdHBkZGR4cmRubnhuZGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTM1NTgsImV4cCI6MjA4OTM2OTU1OH0.96HSdoCSg_JAnt1WVBoIWiKp01feg6rn-y8apPgl1Z8`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: user.email,
              name: user.user_metadata?.full_name
            })
          })
        } catch (err) {
          console.error('Welcome email failed:', err)
        }
      }

      window.location.href = 'dashboard.html'
    }
  })

  // Also check if already logged in
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    window.location.href = 'dashboard.html'
  }

  // Google sign-in button
  document.getElementById('google-btn').addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard.html`
      }
    })
    if (error) {
      console.error('Google sign-in failed:', error.message)
    }
  })
}

// ─── RUNS ON DASHBOARD PAGE ───────────────────────────────────
if (currentPage.includes('dashboard')) {
  const profileModal = document.getElementById('profile-modal-overlay')
  const profileBtn = document.getElementById('profile-btn')
  const profileCloseBtn = document.getElementById('profile-close-btn')
  const profileSaveBtn = document.getElementById('profile-save-btn')
  const profileNameInput = document.getElementById('profile-name')
  const profileEmailInput = document.getElementById('profile-email')
  const profileMessage = document.getElementById('profile-message')
  let activeUser = null

  const getDisplayName = (user) => {
    if (!user) return 'User'
    return user.user_metadata?.full_name
      || user.user_metadata?.name
      || user.email?.split('@')[0]
      || 'User'
  }

  const setProfileMessage = (message, type) => {
    if (!profileMessage) return
    profileMessage.textContent = message || ''
    profileMessage.classList.remove('success', 'error')
    if (type) profileMessage.classList.add(type)
  }

  const setUserUI = (user) => {
    if (!user) return
    activeUser = user
    const displayName = getDisplayName(user)

    if (profileNameInput) profileNameInput.value = displayName
    if (profileEmailInput) profileEmailInput.value = user.email || ''
  }

  const openProfileModal = () => {
    if (!profileModal) return
    setProfileMessage('')
    if (activeUser) setUserUI(activeUser)
    profileModal.classList.add('open')
  }

  const closeProfileModal = () => {
    if (!profileModal) return
    profileModal.classList.remove('open')
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', openProfileModal)
  }

  if (profileCloseBtn) {
    profileCloseBtn.addEventListener('click', closeProfileModal)
  }

  if (profileModal) {
    profileModal.addEventListener('click', (event) => {
      if (event.target === profileModal) closeProfileModal()
    })
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && profileModal?.classList.contains('open')) {
      closeProfileModal()
    }
  })

  if (profileSaveBtn) {
    profileSaveBtn.addEventListener('click', async () => {
      if (!profileNameInput) return
      const nextName = profileNameInput.value.trim()

      if (!nextName) {
        setProfileMessage('Please enter your name.', 'error')
        return
      }

      profileSaveBtn.disabled = true
      setProfileMessage('Saving...')

      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: nextName }
      })

      if (error) {
        setProfileMessage(error.message, 'error')
      } else if (data?.user) {
        setUserUI(data.user)
        setProfileMessage('Profile updated.', 'success')
      } else if (activeUser) {
        activeUser = {
          ...activeUser,
          user_metadata: {
            ...(activeUser.user_metadata || {}),
            full_name: nextName
          }
        }
        setUserUI(activeUser)
        setProfileMessage('Profile updated.', 'success')
      }

      profileSaveBtn.disabled = false
    })
  }

  // Wait for session to be ready
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    setUserUI(session.user)
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      setUserUI(session.user)
    }
    if (event === 'SIGNED_OUT') {
      window.location.href = 'index.html'
    }
  })

  const signOutBtn = document.getElementById('profile-signout-btn')
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut()
      window.location.href = 'index.html'
    })
  }
}
