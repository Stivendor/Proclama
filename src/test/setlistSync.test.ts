import { describe, expect, it } from 'vitest'
import { splitSongIds, mergeRemoteSongIds, resolveConflict } from '@/services/setlistSync'

describe('splitSongIds', () => {
  it('separa canciones con remoteId de las solo-locales preservando orden', () => {
    const map = new Map<number, number>([[1, 100], [3, 300]])
    const r = splitSongIds([1, 2, 3], map)
    expect(r.remote).toEqual([100, 300])
    expect(r.localOnly).toEqual([2])
  })

  it('con todo mapeado no hay localOnly', () => {
    const map = new Map<number, number>([[5, 500]])
    expect(splitSongIds([5], map)).toEqual({ remote: [500], localOnly: [] })
  })
})

describe('mergeRemoteSongIds', () => {
  it('mapea remoteIds a ids locales y conserva las solo-locales al final', () => {
    const localByRemote = new Map<number, number>([[100, 1], [300, 3]])
    expect(mergeRemoteSongIds([300, 100], localByRemote, [2])).toEqual([3, 1, 2])
  })

  it('omite remoteIds sin cancion local (aun no sincronizada)', () => {
    const localByRemote = new Map<number, number>([[100, 1]])
    expect(mergeRemoteSongIds([100, 999], localByRemote, [])).toEqual([1])
  })
})

describe('resolveConflict', () => {
  it('push cuando lo local cambio despues del ultimo sync y lo remoto no es mas nuevo', () => {
    expect(resolveConflict(
      new Date('2026-07-03T12:00:00Z'), '2026-07-03T10:00:00Z', '2026-07-03T10:00:00Z'
    )).toBe('push')
  })

  it('pull cuando lo remoto es mas nuevo que lo local', () => {
    expect(resolveConflict(
      new Date('2026-07-03T10:00:00Z'), '2026-07-03T10:00:00Z', '2026-07-03T12:00:00Z'
    )).toBe('pull')
  })

  it('pull gana en conflicto simultaneo si lo remoto es mas nuevo (LWW)', () => {
    expect(resolveConflict(
      new Date('2026-07-03T11:00:00Z'), '2026-07-03T10:00:00Z', '2026-07-03T12:00:00Z'
    )).toBe('pull')
  })

  it('none cuando no hay cambios en ningun lado', () => {
    expect(resolveConflict(
      new Date('2026-07-03T10:00:00Z'), '2026-07-03T10:00:00Z', '2026-07-03T10:00:00Z'
    )).toBe('none')
  })

  it('push cuando nunca se ha sincronizado (sin lastSyncedAt)', () => {
    expect(resolveConflict(
      new Date('2026-07-03T10:00:00Z'), undefined, '2026-07-03T09:00:00Z'
    )).toBe('push')
  })
})
