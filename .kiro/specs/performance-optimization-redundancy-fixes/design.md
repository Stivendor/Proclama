# Performance Optimization & Redundancy Fixes - Bugfix Design

## Overview

This bugfix addresses 12 critical performance and redundancy issues in the Proclama application that cause excessive bandwidth usage, inefficient database queries, race conditions, and poor user experience. The fixes focus on implementing proper caching strategies, request deduplication, batch loading, AbortController for race condition prevention, and Dexie query optimization with indexes.

The primary issues include:
- Redundant full sync of all songs on every auth state change (CRITICAL)
- Missing request deduplication in Bible search causing duplicate API calls (HIGH)
- Race conditions in LibraryView causing potential data loss (HIGH)
- N+1 query pattern in setlists loading songs individually (HIGH)
- Missing caching for backgrounds, profiles, and Bible chapters (MEDIUM)
- Duplicate code patterns across components (MEDIUM)
- Inefficient full table scans instead of using Dexie indexes (MEDIUM)

The solution implements React best practices including custom hooks, memoization, proper cleanup with AbortController, and reusable abstractions for common patterns.

## Glossary

- **Bug_Condition (C)**: The condition that triggers performance degradation - when redundant operations execute unnecessarily
- **Property (P)**: The desired behavior - operations execute only when needed with proper caching and deduplication
- **Preservation**: Existing functionality that must remain unchanged by the optimization
- **fetchSongs()**: Function in `src/services/supabase.ts` that retrieves all songs from Supabase with pagination
- **useLiveQuery()**: Dexie React hook that reactively queries IndexedDB
- **AbortController**: Web API for canceling pending async operations to prevent race conditions
- **Request Deduplication**: Pattern to prevent multiple identical API calls from executing simultaneously
- **N+1 Query**: Anti-pattern where N individual queries execute instead of one batch query
- **Incremental Sync**: Syncing only changed data instead of full dataset replacement

## Bug Details

### Bug Condition

The bugs manifest when the application performs redundant operations that degrade performance and waste resources. The primary issues occur in:

1. **Auth State Changes** - Every auth change triggers `fetchSongs()` which clears Dexie and re-downloads ALL songs
2. **Bible Search** - Multiple identical searches execute without deduplication or caching
3. **Component Unmounting** - Race conditions occur when async operations continue after navigation
4. **Setlist Loading** - Each song in a setlist triggers an individual Dexie query (N+1 pattern)
5. **Settings View** - Backgrounds fetch from Supabase on every mount without caching
6. **Profile Fetching** - Same user profile fetched twice on auth
7. **Bible Navigation** - No caching of previously loaded chapters
8. **Filter Changes** - Full table scans on every filter change instead of using indexes

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ApplicationEvent
  OUTPUT: boolean
  
  RETURN (input.type == 'AUTH_STATE_CHANGE' AND fetchSongs() executes)
         OR (input.type == 'BIBLE_SEARCH' AND duplicateRequestExists(input.query))
         OR (input.type == 'COMPONENT_UNMOUNT' AND asyncOperationsPending())
         OR (input.type == 'SETLIST_LOAD' AND individualQueriesExecute(input.songIds))
         OR (input.type == 'SETTINGS_MOUNT' AND backgroundsFetchWithoutCache())
         OR (input.type == 'AUTH_SESSION' AND profileFetchedTwice(input.userId))
         OR (input.type == 'BIBLE_CHAPTER_CHANGE' AND noCacheExists(input.chapter))
         OR (input.type == 'FILTER_CHANGE' AND fullTableScanExecutes())
END FUNCTION
```

### Examples

**Example 1: Redundant Sync on Auth Change**
- User logs in → `onAuthStateChange` fires → `fetchSongs()` executes → Dexie cleared → All songs re-downloaded
- User logs out → `onAuthStateChange` fires → `fetchSongs()` executes again → Unnecessary bandwidth usage
- Expected: Sync only when data actually changed, use incremental updates

**Example 2: Bible Search Duplication**
- User types "Juan 3:16" → `searchGlobal()` called
- User presses Enter quickly → `searchGlobal()` called again with same query
- Both API requests execute simultaneously → Duplicate bandwidth and processing
- Expected: Second request should be deduplicated or use cached result

**Example 3: LibraryView Race Condition**
- User navigates to Library → `useEffect` starts `db.songs.clear()`
- User quickly navigates away → Component unmounts but clear() still executes
- Data loss occurs because operation wasn't canceled
- Expected: AbortController cancels pending operations on unmount

**Example 4: Setlist N+1 Query**
- Setlist has 20 songs → `SortableSongItem` renders 20 times
- Each render calls `useLiveQuery(() => db.songs.get(songId))`
- 20 individual Dexie queries execute sequentially
- Expected: One batch query with `db.songs.bulkGet([...songIds])`

**Example 5: Missing Background Cache**
- User opens Settings → `fetchBackgrounds()` called → Supabase query executes
- User closes Settings and reopens → `fetchBackgrounds()` called again → Same data fetched
- Expected: Cache backgrounds in Zustand store, only refetch when stale

**Example 6: Duplicate Profile Fetch**
- Auth session loads → `fetchProfile(userId)` called in `getSession()`
- Auth state change fires → `fetchProfile(userId)` called again in `onAuthStateChange`
- Same profile data fetched twice within milliseconds
- Expected: Cache profile result, skip second fetch if already loaded

**Example 7: Bible Chapter No Cache**
- User views Juan 3 → Chapter loaded from API
- User navigates to Juan 4 → New chapter loaded
- User returns to Juan 3 → Chapter loaded again from API
- Expected: Cache chapters in memory, reuse cached data

**Example 8: Filter Full Table Scan**
- User changes tag filter → `useLiveQuery` executes → All songs loaded into memory → Filter applied in JS
- User changes language filter → Same process repeats
- Expected: Use Dexie compound indexes for efficient filtering

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All existing sync functionality must continue to work correctly
- Song projection, Bible verse display, and setlist management must function identically
- User authentication flow and data migration must remain unchanged
- All UI interactions and navigation must work as before
- Data integrity between local Dexie and remote Supabase must be maintained

**Scope:**
All inputs that do NOT involve the specific performance bottlenecks should be completely unaffected by this fix. This includes:
- Manual user-initiated sync operations
- First-time data loads (initial sync is expected)
- Explicit refresh actions
- Data mutations (create, update, delete operations)

## Hypothesized Root Cause

Based on the bug analysis, the root causes are:

1. **Over-Aggressive Sync Strategy**: The `onAuthStateChange` listener in `src/App.tsx` (lines 68-85) triggers `fetchSongs()` on EVERY auth event, including token refreshes and session checks, not just actual login/logout events. This causes unnecessary full dataset replacements.

2. **Missing Request Deduplication**: The `searchGlobal()` function in `src/services/bible.ts` has no mechanism to prevent duplicate concurrent requests. Each call creates a new fetch, even if an identical request is already in flight.

3. **No Cleanup on Unmount**: The `useEffect` in `src/pages/LibraryView.tsx` (lines 50-70) performs async operations without returning a cleanup function that sets a cancellation flag or uses AbortController, allowing operations to complete after unmount.

4. **Individual Query Pattern**: The `SortableSongItem` component in `src/pages/SetlistsView.tsx` (lines 120-130) uses `useLiveQuery(() => db.songs.get(songId))` for each song individually instead of batch loading all songs at the parent level.

5. **No Cache Layer**: The `fetchBackgrounds()` function in `src/stores/index.ts` (line 180) directly queries Supabase without checking if data is already in the store or implementing a TTL-based cache invalidation strategy.

6. **Duplicate Fetch Logic**: In `src/App.tsx` (lines 60-65), `fetchProfile()` is called both in the initial `getSession()` handler and again in the `onAuthStateChange` callback for the same user session.

7. **No Chapter Cache**: The `fetchChapter()` function in `src/services/bible.ts` always fetches from API or local data without maintaining an in-memory cache of recently accessed chapters.

8. **Missing Dexie Indexes**: The Dexie schema in `src/db/index.ts` lacks compound indexes for common query patterns like `[userId+tags]`, `[userId+language]`, causing full table scans when filtering.

## Correctness Properties

Property 1: Bug Condition - Eliminate Redundant Operations

_For any_ application event where redundant operations would execute (auth changes, duplicate searches, component unmounts, N+1 queries, missing caches), the fixed code SHALL execute operations only when necessary, using caching, deduplication, batch loading, and proper cleanup to prevent unnecessary work.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9, 2.10, 2.11, 2.12**

Property 2: Preservation - Maintain Existing Functionality

_For any_ user interaction or data operation that does NOT involve the specific performance bottlenecks, the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for sync, projection, authentication, and data management.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12**

## Fix Implementation

### Changes Required

The implementation follows a systematic approach to eliminate each performance issue while maintaining backward compatibility.

**File**: `src/App.tsx`

**Function**: `AppContent` component

**Specific Changes**:

1. **Smart Auth Sync (CRITICAL - Issue 1.1)**:
   - Replace unconditional `fetchSongs()` call in `onAuthStateChange` with conditional logic
   - Only sync when event type is `SIGNED_IN` or `SIGNED_OUT`, not on `TOKEN_REFRESHED` or `USER_UPDATED`
   - Implement incremental sync by comparing timestamps instead of full clear + reload
   - Add sync state tracking to prevent concurrent syncs

2. **Deduplicate Profile Fetch (MEDIUM - Issue 1.6)**:
   - Add profile cache in Zustand store with userId as key
   - Check cache before calling `fetchProfile()`
   - Only fetch if cache is empty or userId changed
   - Clear cache on logout

**File**: `src/services/bible.ts`

**Function**: `searchGlobal`, `fetchChapter`

**Specific Changes**:

3. **Request Deduplication for Bible Search (HIGH - Issue 1.2)**:
   - Create `pendingRequests` Map to track in-flight requests by query key
   - Before making API call, check if identical request exists in Map
   - If exists, return the existing Promise
   - After request completes, remove from Map and cache result

4. **Chapter Caching (MEDIUM - Issue 1.7)**:
   - Create `chapterCache` Map with key format `${bookId}:${chapter}:${translation}`
   - Check cache before fetching from API or local data
   - Implement LRU eviction to limit cache size (e.g., 50 chapters max)
   - Add cache invalidation on translation change

**File**: `src/pages/LibraryView.tsx`

**Function**: `LibraryView` component

**Specific Changes**:

5. **Race Condition Prevention (HIGH - Issue 1.3)**:
   - Add AbortController in sync useEffect
   - Set `cancelled` flag in cleanup function
   - Check `cancelled` before executing `db.songs.clear()` and `db.songs.bulkPut()`
   - Abort any pending fetch requests using `signal`

6. **Dexie Index Optimization (MEDIUM - Issue 1.12)**:
   - Update Dexie schema to add compound indexes: `[userId+tags]`, `[userId+language]`
   - Modify query logic to use `.where('[userId+tags]').equals([userId, selectedTag])`
   - Remove in-memory filtering for indexed fields
   - Keep in-memory filtering only for search query (full-text)

7. **Clear Remote Error State (MEDIUM - Issue 1.8)**:
   - Add cleanup in useEffect to call `setRemoteError(null)` on unmount
   - Add error auto-dismiss after 10 seconds

**File**: `src/pages/SetlistsView.tsx`

**Function**: `SetlistsView` component

**Specific Changes**:

8. **Batch Loading for Setlists (HIGH - Issue 1.4)**:
   - Move song loading to parent component level
   - Use `useLiveQuery(() => db.songs.bulkGet(editingSetlist.songIds))` at parent
   - Pass loaded songs array to `SortableSongItem` as prop
   - Remove individual `useLiveQuery` from `SortableSongItem`

**File**: `src/stores/index.ts`

**Function**: `useAppStore`

**Specific Changes**:

9. **Background Caching (MEDIUM - Issue 1.5)**:
   - Add `backgroundsLastFetch` timestamp to store
   - In `fetchBackgrounds()`, check if cache is fresh (< 5 minutes old)
   - Only fetch from Supabase if cache is stale or empty
   - Add manual refresh option for user-initiated updates

**File**: `src/pages/BibleView.tsx`

**Function**: `BibleView` component

**Specific Changes**:

10. **Error State Management (MEDIUM - Issue 1.8)**:
    - Add `chapterError` state for failed chapter loads
    - Display error message to user when chapter fails to load
    - Add retry button in error state
    - Clear error state when chapter changes successfully

**File**: `src/pages/NotesView.tsx`

**Function**: `NotesView` component

**Specific Changes**:

11. **Sync Feedback (MEDIUM - Issue 1.9)**:
    - Add `syncing` state boolean
    - Show loading indicator during Supabase sync
    - Display success/error toast immediately after sync attempt
    - Keep existing local-first save behavior

**File**: `src/services/supabase.ts`

**Function**: `fetchSongs`

**Specific Changes**:

12. **Query Caching (MEDIUM - Issue 1.11)**:
    - Add module-level cache Map for songs with timestamp
    - Check cache before executing Supabase query
    - Return cached data if fresh (< 2 minutes old)
    - Invalidate cache on mutations (create, update, delete)

**File**: `src/hooks/useDataSync.ts` (NEW)

**Function**: Custom hook for reusable sync pattern

**Specific Changes**:

13. **Abstraction for Common Patterns (MEDIUM - Issue 1.10)**:
    - Create `useDataSync` hook with local-then-remote pattern
    - Create `useRequestDeduplication` hook for API call deduplication
    - Create `useBatchQuery` hook for Dexie batch operations
    - Refactor existing components to use these hooks

**File**: `src/db/index.ts`

**Function**: Dexie schema

**Specific Changes**:

14. **Add Compound Indexes**:
    - Update schema version to 5
    - Add indexes: `songs: '++id, title, artist, language, usageCount, userId, [userId+tags], [userId+language], createdAt'`
    - Add migration logic to preserve existing data

## Testing Strategy

### Validation Approach

The testing strategy follows a three-phase approach: first, demonstrate the performance issues on unfixed code with metrics, then verify the fixes eliminate the bottlenecks, and finally ensure no regressions in existing functionality.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the performance bugs BEFORE implementing the fix. Measure baseline performance metrics to quantify improvements.

**Test Plan**: Write tests that simulate the problematic scenarios and measure execution time, network requests, and database queries. Run these tests on the UNFIXED code to establish baseline metrics.

**Test Cases**:
1. **Auth Change Redundancy Test**: Monitor network tab during login/logout cycle, count fetchSongs() calls (will show multiple unnecessary calls on unfixed code)
2. **Bible Search Duplication Test**: Trigger searchGlobal() twice rapidly with same query, verify two API calls execute (will show duplication on unfixed code)
3. **LibraryView Race Condition Test**: Navigate to Library then immediately away, check if db.songs.clear() completes (will show race condition on unfixed code)
4. **Setlist N+1 Test**: Load setlist with 20 songs, count Dexie queries executed (will show 20 individual queries on unfixed code)
5. **Background Cache Test**: Open Settings twice, count Supabase queries (will show 2 queries on unfixed code)
6. **Profile Duplicate Test**: Monitor fetchProfile() calls during login (will show 2 calls on unfixed code)
7. **Chapter Cache Test**: Navigate Juan 3 → Juan 4 → Juan 3, count API calls (will show 3 calls on unfixed code)
8. **Filter Performance Test**: Change filters 10 times, measure total execution time (will show slow performance on unfixed code)

**Expected Counterexamples**:
- Multiple fetchSongs() calls on single auth event
- Duplicate API requests for identical Bible searches
- Database operations completing after component unmount
- N individual queries instead of 1 batch query
- Repeated fetches of identical data without caching
- Full table scans on every filter change

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected optimized behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := executeOperation_fixed(input)
  ASSERT expectedBehavior(result)
  ASSERT performanceImproved(result, baseline)
END FOR
```

**Performance Metrics to Verify**:
- Auth sync: fetchSongs() calls reduced from N to 1 per actual login/logout
- Bible search: Duplicate requests eliminated (0 duplicate API calls)
- Race conditions: No operations execute after unmount (0 post-unmount operations)
- Setlist loading: Queries reduced from N to 1 batch query
- Background fetch: Supabase calls reduced from N to 1 with cache
- Profile fetch: Calls reduced from 2 to 1 per session
- Chapter navigation: API calls reduced by ~66% with cache
- Filter changes: Execution time reduced by ~80% with indexes

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) = fixedBehavior(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-optimized paths

**Test Plan**: Verify existing functionality works identically after optimizations.

**Test Cases**:
1. **Song Projection Preservation**: Verify songs project correctly with same visual output
2. **Bible Verse Display Preservation**: Verify verses display with same formatting and content
3. **Setlist Management Preservation**: Verify create/edit/delete operations work identically
4. **Auth Flow Preservation**: Verify login/logout/guest mode work identically
5. **Data Sync Preservation**: Verify local-remote sync maintains data integrity
6. **Search Results Preservation**: Verify search returns same results with same ordering
7. **Filter Results Preservation**: Verify filters produce same results
8. **Navigation Preservation**: Verify all view transitions work identically

### Unit Tests

- Test `useDataSync` hook with mock data sources
- Test `useRequestDeduplication` with concurrent calls
- Test `useBatchQuery` with various array sizes
- Test AbortController cleanup in LibraryView
- Test cache invalidation logic in stores
- Test Dexie compound index queries
- Test auth event filtering logic
- Test chapter cache LRU eviction

### Property-Based Tests

- Generate random auth event sequences, verify only SIGNED_IN/SIGNED_OUT trigger sync
- Generate random Bible search queries, verify no duplicate API calls
- Generate random setlist sizes, verify always 1 batch query regardless of size
- Generate random navigation patterns, verify no post-unmount operations
- Generate random filter combinations, verify results match unoptimized version
- Generate random cache access patterns, verify cache hit/miss logic correct

### Integration Tests

- Test full user flow: login → browse library → create setlist → project songs
- Test Bible flow: search → navigate chapters → project verses
- Test sync flow: offline changes → go online → verify sync
- Test performance: measure end-to-end operation times before/after fix
- Test concurrent operations: multiple users, multiple tabs
- Test error scenarios: network failures, database errors, race conditions
