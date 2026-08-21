const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/

export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0'

function parseVersion(version: string): [number, number, number] | null {
  const match = VERSION_PATTERN.exec(version)
  if (!match) return null

  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 | null {
  const parsedLeft = parseVersion(left)
  const parsedRight = parseVersion(right)
  if (!parsedLeft || !parsedRight) return null

  for (let index = 0; index < parsedLeft.length; index += 1) {
    if (parsedLeft[index] < parsedRight[index]) return -1
    if (parsedLeft[index] > parsedRight[index]) return 1
  }

  return 0
}

export function isVersionSupported(localVersion: string, minimumVersion: string): boolean {
  const comparison = compareVersions(localVersion, minimumVersion)
  return comparison === null || comparison >= 0
}
