# Two Libraries: Mi Cancionero + Comunidad

## Problem

Proclama's single `LibraryView` mixes the user's own songs with public songs synced from Supabase, making it hard to distinguish "my songs" from "community songs."

## Design

Add two tabs at the top of `LibraryView` — **Mi Cancionero** and **Comunidad** — that filter the same underlying Dexie data into separate scopes, each with appropriate actions.

## Tab bar

Two tabs above the search/filter bar, styled like existing button groups. State is local `useState<'locals' | 'community'>` in `LibraryView`. No route changes, no new sidebar entries.

## Filtering logic

Each tab filters the `db.songs` Dexie query:

| Tab | Filter | Notes |
|-----|--------|-------|
| **Mi Cancionero** | `userId === currentUserId` OR `!remoteId` | Owned songs + local-only (never synced) |
| **Comunidad** | `isPublic === true` AND `remoteId !== undefined` | Public songs from other users |

Search, tag filter, and language filter work within the active tab scope.

## Actions per tab

### Mi Cancionero (full CRUD)
- Create, Edit, Delete, Project, Add to setlist
- Same behavior as current library
- "Nueva" button creates a new local song

### Comunidad (read + import)
- View details, Project
- **Import** — copies song to Dexie + creates in Supabase as user's own song
- **Search online** — triggers direct Supabase RPC query (`search_songs_community`) for fresh results
- **Report** — opens existing `ReportSongModal`
- No Edit, no Delete

## Import flow

1. User clicks "Import" on a Community song
2. Create new `db.songs` entry with: same title/artist/lyrics/key/tags/language, `userId: currentUser.id`, no `remoteId`, `isPublic: false`
3. Also call `createSong()` in Supabase to persist as user's own song (backup)
4. Show toast on success

## "Search online" in Comunidad

A "Buscar en línea" button in the Comunidad tab header. When clicked, it queries Supabase's `search_songs_community` RPC directly (existing `searchSongs()`) and shows results BELOW the Dexie-synced list as a distinct section labeled "Resultados en línea". Results update on each search query. This replaces the need for `OnlineSearchModal` from the Comunidad tab (but the modal stays available from Mi Cancionero).

## Sidebar

No changes — still a single "Canciones" entry in the sidebar. The library view handles tabbing internally.

## Dexie schema

No schema changes. Songs already have `remoteId`, `userId`, `isPublic` fields sufficient for filtering.

## AppStore

No new global state. The active tab is local to `LibraryView`. If we want tab persistence across navigation, we can add a `libraryTab` field later.

## Edge cases

- **Guest user (no auth):** Mi Cancionero shows all local songs (`!remoteId`). Comunidad shows public songs from Dexie sync. Import uses `userId: undefined`.
- **Loading state:** Show spinner while Dexie query resolves, same as current.
- **Empty state:** Each tab shows its own empty message ("No tienes canciones. Crea una nueva." / "No hay canciones públicas. Busca en línea.")
- **Sync in progress:** The sync effect runs independently of which tab is active. The spinner in the header already covers this.
- **Import race condition:** If a song is imported and the sync runs simultaneously, the dedup logic in sync handles it (matches by title+artist).
- **Free plan limits:** `canCreateSong` limit applies only in Mi Cancionero. Projection limits apply in both tabs.

## Files changed

1. `src/pages/LibraryView.tsx` — add tab bar, conditional filtering, import action in Community view
2. `src/pages/LibraryView.tsx` (import action) — add `handleImportFromCommunity` function
3. `src/index.css` — add tab bar styles (if needed, otherwise inline styles)
