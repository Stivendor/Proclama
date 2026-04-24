const DEVICE_KEY = 'proclama-device-id'

/**
 * Returns a stable unique ID for this browser/device.
 * Generated once and persisted in localStorage.
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

/**
 * Returns a human-readable name for the current device based on the user agent.
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent
  if (ua.includes('Windows')) return 'PC Windows'
  if (ua.includes('Mac')) return 'Mac'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iPhone/iPad'
  return 'Dispositivo'
}
