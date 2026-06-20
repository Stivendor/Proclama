import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import { supabase } from '@/services/supabase'
import { onMessage } from '@/services/projection'
import { isPremiumFromProfile } from '@/hooks/usePlan'

export function useAuth() {
  const [needsChurchReg, setNeedsChurchReg] = useState(false)
  const [showTermsUpdateModal, setShowTermsUpdateModal] = useState(false)
  const initRef = useRef(false)

  const { setUser, setUserRole, setUserPlan, setPremiumExpiresAt, setAuthStatus, acceptTerms, checkTermsVersion } =
    useAppStore(
      useShallow((s) => ({
        setUser: s.setUser,
        setUserRole: s.setUserRole,
        setUserPlan: s.setUserPlan,
        setPremiumExpiresAt: s.setPremiumExpiresAt,
        setAuthStatus: s.setAuthStatus,
        acceptTerms: s.acceptTerms,
        checkTermsVersion: s.checkTermsVersion,
      }))
    )

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (initRef.current) return
    initRef.current = true

    // Safety net: if auth doesn't resolve in 10s, fall back to unauthenticated
    const authTimeout = setTimeout(() => {
      if (useAppStore.getState().authStatus === 'loading') {
        console.warn('Auth initialization timed out, falling back to unauthenticated.')
        setAuthStatus('unauthenticated')
      }
    }, 10000)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (
          event !== 'SIGNED_IN' &&
          event !== 'SIGNED_OUT' &&
          event !== 'INITIAL_SESSION'
        ) {
          return
        }

        const user = session?.user ?? null
        setUser(user)

        if (user) {
          useAppStore.getState().setForceLanding(false)
          clearTimeout(authTimeout)
          setAuthStatus('authenticated')

          // Background sync — non-blocking
          ;(async () => {
            try {
              const { fetchProfile } = await import('@/services/supabase')
              const profile = await fetchProfile(user.id)

              const profileIsPremium = profile
                ? isPremiumFromProfile({
                    plan: profile.plan,
                    role: profile.role,
                    premiumExpiresAt: profile.premiumExpiresAt,
                  })
                : false

              if (profile) {
                setUserRole(profile.role)
                setUserPlan(profile.plan)
                setPremiumExpiresAt(profile.premiumExpiresAt)

                if (profileIsPremium) {
                  import('@/services/attendanceSync')
                    .then(async ({ pullRemoteRecords, syncAttendanceRecords, migrateGuestRecords }) => {
                      try {
                        await migrateGuestRecords(user.id)
                        await pullRemoteRecords(user.id)
                        await syncAttendanceRecords(user.id)
                      } catch {}
                    })
                    .catch(() => {})
                }
              }

              useAppStore.getState().fetchCloudSettings()

              // Device check — admins are exempt from the device limit
              if (profileIsPremium && profile?.role !== 'admin') {
                import('@/utils/deviceFingerprint')
                  .then(async ({ getDeviceId, getDeviceName }) => {
                    const { fetchUserDevices, registerDevice } = await import('@/services/supabase')
                    const { MAX_DEVICES_PREMIUM } = await import('@/constants/plans')
                    const deviceId = getDeviceId()
                    const deviceName = getDeviceName()
                    const devices = await fetchUserDevices(deviceId)
                    if (!devices.some((d) => d.deviceId === deviceId) && devices.length >= MAX_DEVICES_PREMIUM) {
                      useAppStore.getState().setUserDevices(devices)
                      useAppStore.getState().setDeviceBlocked(true)
                    } else {
                      const updatedDevices = await registerDevice(deviceId, deviceName)
                      useAppStore.getState().setUserDevices(updatedDevices)
                      useAppStore.getState().setDeviceBlocked(false)
                    }
                  })
                  .catch((err) => console.warn('Device check failed:', err))
              }

              // Terms sync
              const { fetchTermsAcceptance, syncTermsAcceptance } = await import('@/services/supabase')
              const currentTerms = useAppStore.getState().termsAccepted
              const shouldUpdateTerms = useAppStore.getState().checkTermsVersion()

              if (currentTerms && !shouldUpdateTerms) {
                const { termsSyncPending } = useAppStore.getState()
                if (termsSyncPending && currentTerms) {
                  await syncTermsAcceptance(user.id, currentTerms.version, currentTerms.acceptedAt)
                  useAppStore.getState().setTermsSyncPending(false)
                }
              } else {
                const remoteTerms = await fetchTermsAcceptance(user.id)
                if (remoteTerms) useAppStore.getState().setTermsAccepted(remoteTerms)
                if (useAppStore.getState().checkTermsVersion()) {
                  setShowTermsUpdateModal(true)
                }
              }

              const { termsSyncPending, termsAccepted } = useAppStore.getState()
              if (termsSyncPending && termsAccepted) {
                await syncTermsAcceptance(user.id, termsAccepted.version, termsAccepted.acceptedAt)
                useAppStore.getState().setTermsSyncPending(false)
              }

              // Google users without onboarding need church registration
              if (user.app_metadata?.provider === 'google') {
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('full_name, settings')
                  .eq('id', user.id)
                  .maybeSingle()

                const settings = profileData?.settings as Record<string, unknown> | null
                if (!profileData?.full_name || !settings?.onboardingComplete) {
                  setNeedsChurchReg(true)
                }
              }
            } catch (err) {
              console.warn('Post-login sync tasks had issues:', err)
            }
          })()
        } else {
          setUserRole(null)
          setUserPlan('free')
          if (event === 'SIGNED_OUT') {
            useAppStore.getState().logout()
          }
          clearTimeout(authTimeout)
          setAuthStatus('unauthenticated')
        }
      } catch (err) {
        console.error('Auth event processing failed:', err)
        clearTimeout(authTimeout)
        setAuthStatus('unauthenticated')
      }
    })

    const offMedia = onMessage((msg) => {
      if (msg.type === 'MEDIA_STATUS') {
        useProjectionStore.getState().setMediaStatus(msg.payload)
      }
    })

    return () => {
      subscription.unsubscribe()
      offMedia()
    }
  }, [setAuthStatus, setUser, setUserRole, setUserPlan])

  return { needsChurchReg, setNeedsChurchReg, showTermsUpdateModal, setShowTermsUpdateModal }
}
