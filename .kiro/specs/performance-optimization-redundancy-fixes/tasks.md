# Implementation Plan

## Phase 1: Bug Condition Exploration Tests

- [ ] 1. Write bug condition exploration tests for 12 performance issues
  - **Property 1: Bug Condition** - Performance Degradation Across 12 Issues
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failures confirm the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each performance bug exists with baseline metrics
  
  - [ ] 1.1 Test redundant auth sync (CRITICAL - Issue 1.1)
    - Monitor fetchSongs() calls during login/logout cycle
    - Assert: fetchSongs() called only on SIGNED_IN/SIGNED_OUT events (not TOKEN_REFRESHED)
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows multiple unnecessary fetchSongs() calls
    - Document: Count of redundant calls and bandwidth usage
    - _Requirements: 2.1_
  
  - [ ] 1.2 Test Bible search duplication (HIGH - Issue 1.2)
    - Trigger searchGlobal() twice rapidly with same query
    - Assert: Only one API call executes, second request deduplicated
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows duplicate API calls
    - Document: Number of duplicate requests
    - _Requirements: 2.2_
  
  - [ ] 1.3 Test LibraryView race condition (HIGH - Issue 1.3)
    - Navigate to Library then immediately away
    - Assert: db.songs.clear() cancelled on unmount
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows operation completes after unmount
    - Document: Race condition occurrence
    - _Requirements: 2.3_
  
  - [ ] 1.4 Test setlist N+1 query pattern (HIGH - Issue 1.4)
    - Load setlist with 20 songs
    - Assert: Only 1 batch query executed (not 20 individual queries)
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows 20 individual Dexie queries
    - Document: Query count and execution time
    - _Requirements: 2.4_
  
  - [ ] 1.5 Test background cache missing (MEDIUM - Issue 1.5)
    - Open Settings twice
    - Assert: fetchBackgrounds() called only once (cached on second open)
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows 2 Supabase queries
    - Document: Number of redundant fetches
    - _Requirements: 2.5_
  
  - [ ] 1.6 Test duplicate profile fetch (MEDIUM - Issue 1.6)
    - Monitor fetchProfile() calls during login
    - Assert: fetchProfile() called only once per session
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows 2 calls for same user
    - Document: Duplicate call locations
    - _Requirements: 2.6_
  
  - [ ] 1.7 Test chapter cache missing (MEDIUM - Issue 1.7)
    - Navigate Juan 3 → Juan 4 → Juan 3
    - Assert: Juan 3 loaded from cache on second visit
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows 3 API calls (no cache)
    - Document: Cache miss rate
    - _Requirements: 2.7_
  
  - [ ] 1.8 Test error state management (MEDIUM - Issue 1.8)
    - Trigger errors in LibraryView, BibleView, SettingsView
    - Assert: Error states cleared appropriately
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows error states not cleared
    - Document: Error state leaks
    - _Requirements: 2.8_
  
  - [ ] 1.9 Test sync feedback missing (MEDIUM - Issue 1.9)
    - Sync attendance in NotesView
    - Assert: User receives immediate feedback on sync status
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows no immediate feedback
    - Document: Feedback delay
    - _Requirements: 2.9_
  
  - [ ] 1.10 Test code duplication (MEDIUM - Issue 1.10)
    - Analyze fetch patterns across components
    - Assert: Common patterns abstracted into reusable hooks
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows duplicate code patterns
    - Document: Duplicate code locations
    - _Requirements: 2.10_
  
  - [ ] 1.11 Test query caching missing (MEDIUM - Issue 1.11)
    - Call fetchSongs() multiple times
    - Assert: Subsequent calls use cache
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows repeated fetches
    - Document: Cache miss count
    - _Requirements: 2.11_
  
  - [ ] 1.12 Test filter performance (MEDIUM - Issue 1.12)
    - Change filters 10 times in LibraryView
    - Assert: Queries use Dexie indexes (not full table scan)
    - Run on UNFIXED code
    - **EXPECTED OUTCOME**: Test FAILS - shows slow full table scans
    - Document: Execution time baseline
    - _Requirements: 2.12_

## Phase 2: Preservation Property Tests

- [ ] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 2: Preservation** - Existing Functionality Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-optimized paths
  - Write property-based tests capturing observed behavior patterns
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  
  - [ ] 2.1 Test song projection preservation
    - Observe: Songs project correctly with same visual output
    - Property: For all songs, projection output matches original behavior
    - Verify test passes on UNFIXED code
    - _Requirements: 3.2_
  
  - [ ] 2.2 Test Bible verse display preservation
    - Observe: Verses display with same formatting and content
    - Property: For all verses, display format matches original behavior
    - Verify test passes on UNFIXED code
    - _Requirements: 3.12_
  
  - [ ] 2.3 Test setlist management preservation
    - Observe: Create/edit/delete operations work correctly
    - Property: For all setlist operations, data integrity maintained
    - Verify test passes on UNFIXED code
    - _Requirements: 3.3_
  
  - [ ] 2.4 Test auth flow preservation
    - Observe: Login/logout/guest mode work correctly
    - Property: For all auth operations, session state managed correctly
    - Verify test passes on UNFIXED code
    - _Requirements: 3.1, 3.10_
  
  - [ ] 2.5 Test data sync preservation
    - Observe: Local-remote sync maintains data integrity
    - Property: For all sync operations, data consistency preserved
    - Verify test passes on UNFIXED code
    - _Requirements: 3.1, 3.4_
  
  - [ ] 2.6 Test search results preservation
    - Observe: Search returns correct results with same ordering
    - Property: For all search queries, results match original behavior
    - Verify test passes on UNFIXED code
    - _Requirements: 3.5_
  
  - [ ] 2.7 Test filter results preservation
    - Observe: Filters produce correct results
    - Property: For all filter combinations, results match original behavior
    - Verify test passes on UNFIXED code
    - _Requirements: 3.5_
  
  - [ ] 2.8 Test navigation preservation
    - Observe: All view transitions work correctly
    - Property: For all navigation paths, state maintained correctly
    - Verify test passes on UNFIXED code
    - _Requirements: 3.6_
  
  - [ ] 2.9 Test background/theme preservation
    - Observe: Backgrounds and themes apply correctly
    - Property: For all style configurations, rendering matches original
    - Verify test passes on UNFIXED code
    - _Requirements: 3.7_
  
  - [ ] 2.10 Test plan restrictions preservation
    - Observe: Free/premium restrictions enforced correctly
    - Property: For all plan types, restrictions match original behavior
    - Verify test passes on UNFIXED code
    - _Requirements: 3.8_
  
  - [ ] 2.11 Test import/export preservation
    - Observe: Import/export maintains data format compatibility
    - Property: For all import/export operations, data format preserved
    - Verify test passes on UNFIXED code
    - _Requirements: 3.9_
  
  - [ ] 2.12 Test online search preservation
    - Observe: Genius API integration works correctly
    - Property: For all online searches, integration matches original behavior
    - Verify test passes on UNFIXED code
    - _Requirements: 3.11_

## Phase 3: Core Optimizations

- [ ] 3. Fix CRITICAL Issue: Redundant Auth Sync (Issue 1.1)
  
  - [ ] 3.1 Implement smart auth sync in src/App.tsx
    - Replace unconditional fetchSongs() with conditional logic
    - Only sync on SIGNED_IN or SIGNED_OUT events (not TOKEN_REFRESHED, USER_UPDATED)
    - Add sync state tracking to prevent concurrent syncs
    - Implement incremental sync by comparing timestamps
    - _Bug_Condition: isBugCondition where input.type == 'AUTH_STATE_CHANGE' AND fetchSongs() executes unnecessarily_
    - _Expected_Behavior: Sync only when event type is SIGNED_IN or SIGNED_OUT_
    - _Preservation: Auth flow and data integrity must remain unchanged (3.1, 3.4)_
    - _Requirements: 2.1, 3.1, 3.4_
  
  - [ ] 3.2 Verify auth sync exploration test now passes
    - **Property 1: Expected Behavior** - Smart Auth Sync
    - **IMPORTANT**: Re-run the SAME test from task 1.1 - do NOT write a new test
    - Run test from step 1.1
    - **EXPECTED OUTCOME**: Test PASSES (confirms redundant syncs eliminated)
    - _Requirements: 2.1_
  
  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Auth Flow Unchanged
    - **IMPORTANT**: Re-run preservation tests 2.4 and 2.5
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [ ] 4. Fix HIGH Priority: Bible Search Deduplication (Issue 1.2)
  
  - [ ] 4.1 Implement request deduplication in src/services/bible.ts
    - Create pendingRequests Map to track in-flight requests by query key
    - Check Map before making API call, return existing Promise if found
    - Remove from Map after completion and cache result
    - Add cache with TTL for search results
    - _Bug_Condition: isBugCondition where input.type == 'BIBLE_SEARCH' AND duplicateRequestExists_
    - _Expected_Behavior: Second request deduplicated or uses cached result_
    - _Preservation: Search results and ordering must remain unchanged (3.5)_
    - _Requirements: 2.2, 3.5_
  
  - [ ] 4.2 Verify Bible search exploration test now passes
    - **Property 1: Expected Behavior** - Request Deduplication
    - Re-run test from step 1.2
    - **EXPECTED OUTCOME**: Test PASSES (confirms deduplication works)
    - _Requirements: 2.2_
  
  - [ ] 4.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Search Results Unchanged
    - Re-run preservation test 2.6
    - **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)

- [ ] 5. Fix HIGH Priority: LibraryView Race Condition (Issue 1.3)
  
  - [ ] 5.1 Implement AbortController in src/pages/LibraryView.tsx
    - Add AbortController in sync useEffect
    - Set cancelled flag in cleanup function
    - Check cancelled before executing db.songs.clear() and db.songs.bulkPut()
    - Abort pending fetch requests using signal
    - _Bug_Condition: isBugCondition where input.type == 'COMPONENT_UNMOUNT' AND asyncOperationsPending_
    - _Expected_Behavior: Operations cancelled on unmount, no data loss_
    - _Preservation: Library functionality and data integrity unchanged (3.1, 3.5)_
    - _Requirements: 2.3, 3.1, 3.5_
  
  - [ ] 5.2 Verify race condition exploration test now passes
    - **Property 1: Expected Behavior** - Race Condition Prevention
    - Re-run test from step 1.3
    - **EXPECTED OUTCOME**: Test PASSES (confirms race condition fixed)
    - _Requirements: 2.3_
  
  - [ ] 5.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Library Functionality Unchanged
    - Re-run preservation tests 2.5, 2.6, 2.7
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [ ] 6. Fix HIGH Priority: Setlist N+1 Query Pattern (Issue 1.4)
  
  - [ ] 6.1 Implement batch loading in src/pages/SetlistsView.tsx
    - Move song loading to parent component level
    - Use useLiveQuery(() => db.songs.bulkGet(editingSetlist.songIds))
    - Pass loaded songs array to SortableSongItem as prop
    - Remove individual useLiveQuery from SortableSongItem
    - _Bug_Condition: isBugCondition where input.type == 'SETLIST_LOAD' AND individualQueriesExecute_
    - _Expected_Behavior: One batch query with db.songs.bulkGet([...songIds])_
    - _Preservation: Setlist management must remain unchanged (3.3)_
    - _Requirements: 2.4, 3.3_
  
  - [ ] 6.2 Verify N+1 query exploration test now passes
    - **Property 1: Expected Behavior** - Batch Loading
    - Re-run test from step 1.4
    - **EXPECTED OUTCOME**: Test PASSES (confirms batch loading works)
    - _Requirements: 2.4_
  
  - [ ] 6.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Setlist Management Unchanged
    - Re-run preservation test 2.3
    - **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)

## Phase 4: Caching & Indexes

- [ ] 7. Fix MEDIUM Priority: Background Caching (Issue 1.5)
  
  - [ ] 7.1 Implement background cache in src/stores/index.ts
    - Add backgroundsLastFetch timestamp to store
    - Check if cache is fresh (< 5 minutes old) before fetching
    - Only fetch from Supabase if cache is stale or empty
    - Add manual refresh option for user-initiated updates
    - _Bug_Condition: isBugCondition where input.type == 'SETTINGS_MOUNT' AND backgroundsFetchWithoutCache_
    - _Expected_Behavior: Cache backgrounds, only refetch when stale_
    - _Preservation: Background/theme functionality unchanged (3.7)_
    - _Requirements: 2.5, 3.7_
  
  - [ ] 7.2 Verify background cache exploration test now passes
    - **Property 1: Expected Behavior** - Background Caching
    - Re-run test from step 1.5
    - **EXPECTED OUTCOME**: Test PASSES (confirms caching works)
    - _Requirements: 2.5_
  
  - [ ] 7.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Background/Theme Unchanged
    - Re-run preservation test 2.9
    - **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)

- [ ] 8. Fix MEDIUM Priority: Duplicate Profile Fetch (Issue 1.6)
  
  - [ ] 8.1 Implement profile cache in src/App.tsx
    - Add profile cache in Zustand store with userId as key
    - Check cache before calling fetchProfile()
    - Only fetch if cache is empty or userId changed
    - Clear cache on logout
    - _Bug_Condition: isBugCondition where input.type == 'AUTH_SESSION' AND profileFetchedTwice_
    - _Expected_Behavior: fetchProfile() called only once per session_
    - _Preservation: Auth flow unchanged (3.1)_
    - _Requirements: 2.6, 3.1_
  
  - [ ] 8.2 Verify profile fetch exploration test now passes
    - **Property 1: Expected Behavior** - Profile Deduplication
    - Re-run test from step 1.6
    - **EXPECTED OUTCOME**: Test PASSES (confirms deduplication works)
    - _Requirements: 2.6_
  
  - [ ] 8.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Auth Flow Unchanged
    - Re-run preservation test 2.4
    - **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)

- [ ] 9. Fix MEDIUM Priority: Chapter Caching (Issue 1.7)
  
  - [ ] 9.1 Implement chapter cache in src/services/bible.ts
    - Create chapterCache Map with key format ${bookId}:${chapter}:${translation}
    - Check cache before fetching from API or local data
    - Implement LRU eviction to limit cache size (50 chapters max)
    - Add cache invalidation on translation change
    - _Bug_Condition: isBugCondition where input.type == 'BIBLE_CHAPTER_CHANGE' AND noCacheExists_
    - _Expected_Behavior: Cache chapters, reuse cached data_
    - _Preservation: Bible verse display unchanged (3.12)_
    - _Requirements: 2.7, 3.12_
  
  - [ ] 9.2 Verify chapter cache exploration test now passes
    - **Property 1: Expected Behavior** - Chapter Caching
    - Re-run test from step 1.7
    - **EXPECTED OUTCOME**: Test PASSES (confirms caching works)
    - _Requirements: 2.7_
  
  - [ ] 9.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Bible Display Unchanged
    - Re-run preservation test 2.2
    - **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)

- [ ] 10. Fix MEDIUM Priority: Query Caching (Issue 1.11)
  
  - [ ] 10.1 Implement query cache in src/services/supabase.ts
    - Add module-level cache Map for songs with timestamp
    - Check cache before executing Supabase query
    - Return cached data if fresh (< 2 minutes old)
    - Invalidate cache on mutations (create, update, delete)
    - _Bug_Condition: isBugCondition where fetchSongs() called multiple times without cache_
    - _Expected_Behavior: Subsequent calls use cache_
    - _Preservation: Data sync integrity unchanged (3.1, 3.4)_
    - _Requirements: 2.11, 3.1, 3.4_
  
  - [ ] 10.2 Verify query cache exploration test now passes
    - **Property 1: Expected Behavior** - Query Caching
    - Re-run test from step 1.11
    - **EXPECTED OUTCOME**: Test PASSES (confirms caching works)
    - _Requirements: 2.11_
  
  - [ ] 10.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Data Sync Unchanged
    - Re-run preservation test 2.5
    - **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)

- [ ] 11. Fix MEDIUM Priority: Dexie Index Optimization (Issue 1.12)
  
  - [ ] 11.1 Add compound indexes in src/db/index.ts
    - Update schema version to 5
    - Add indexes: [userId+tags], [userId+language]
    - Add migration logic to preserve existing data
    - _Requirements: 2.12, 3.1_
  
  - [ ] 11.2 Update LibraryView queries in src/pages/LibraryView.tsx
    - Modify query logic to use .where('[userId+tags]').equals([userId, selectedTag])
    - Remove in-memory filtering for indexed fields
    - Keep in-memory filtering only for search query (full-text)
    - _Bug_Condition: isBugCondition where input.type == 'FILTER_CHANGE' AND fullTableScanExecutes_
    - _Expected_Behavior: Use Dexie compound indexes for efficient filtering_
    - _Preservation: Filter results unchanged (3.5)_
    - _Requirements: 2.12, 3.5_
  
  - [ ] 11.3 Verify filter performance exploration test now passes
    - **Property 1: Expected Behavior** - Index Optimization
    - Re-run test from step 1.12
    - **EXPECTED OUTCOME**: Test PASSES (confirms indexes improve performance)
    - _Requirements: 2.12_
  
  - [ ] 11.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Filter Results Unchanged
    - Re-run preservation test 2.7
    - **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)

## Phase 5: Error Handling & UX

- [ ] 12. Fix MEDIUM Priority: Error State Management (Issue 1.8)
  
  - [ ] 12.1 Fix LibraryView error cleanup in src/pages/LibraryView.tsx
    - Add cleanup in useEffect to call setRemoteError(null) on unmount
    - Add error auto-dismiss after 10 seconds
    - _Requirements: 2.8, 3.1_
  
  - [ ] 12.2 Add BibleView error state in src/pages/BibleView.tsx
    - Add chapterError state for failed chapter loads
    - Display error message to user when chapter fails to load
    - Add retry button in error state
    - Clear error state when chapter changes successfully
    - _Requirements: 2.8, 3.12_
  
  - [ ] 12.3 Add SettingsView error handling in src/pages/SettingsView.tsx
    - Add error handling for background fetch failures
    - Display error message to user
    - Add retry option
    - _Requirements: 2.8, 3.7_
  
  - [ ] 12.4 Verify error state exploration test now passes
    - **Property 1: Expected Behavior** - Error State Management
    - Re-run test from step 1.8
    - **EXPECTED OUTCOME**: Test PASSES (confirms error states managed correctly)
    - _Requirements: 2.8_
  
  - [ ] 12.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Functionality Unchanged
    - Re-run preservation tests 2.2, 2.5, 2.9
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

- [ ] 13. Fix MEDIUM Priority: Sync Feedback (Issue 1.9)
  
  - [ ] 13.1 Implement sync feedback in src/pages/NotesView.tsx
    - Add syncing state boolean
    - Show loading indicator during Supabase sync
    - Display success/error toast immediately after sync attempt
    - Keep existing local-first save behavior
    - _Bug_Condition: isBugCondition where sync occurs without immediate user feedback_
    - _Expected_Behavior: User receives immediate feedback on sync status_
    - _Preservation: Attendance sync functionality unchanged (3.4)_
    - _Requirements: 2.9, 3.4_
  
  - [ ] 13.2 Verify sync feedback exploration test now passes
    - **Property 1: Expected Behavior** - Sync Feedback
    - Re-run test from step 1.9
    - **EXPECTED OUTCOME**: Test PASSES (confirms feedback works)
    - _Requirements: 2.9_
  
  - [ ] 13.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Sync Functionality Unchanged
    - Re-run preservation test 2.5
    - **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)

## Phase 6: Code Abstraction

- [ ] 14. Fix MEDIUM Priority: Code Duplication (Issue 1.10)
  
  - [ ] 14.1 Create reusable hooks in src/hooks/useDataSync.ts (NEW)
    - Create useDataSync hook with local-then-remote pattern
    - Create useRequestDeduplication hook for API call deduplication
    - Create useBatchQuery hook for Dexie batch operations
    - _Requirements: 2.10_
  
  - [ ] 14.2 Refactor components to use new hooks
    - Refactor bible.ts to use useRequestDeduplication
    - Refactor LibraryView to use useDataSync
    - Refactor SetlistsView to use useBatchQuery
    - _Bug_Condition: isBugCondition where duplicate code patterns exist_
    - _Expected_Behavior: Common patterns abstracted into reusable hooks_
    - _Preservation: All functionality unchanged (3.1-3.12)_
    - _Requirements: 2.10, 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ] 14.3 Verify code duplication exploration test now passes
    - **Property 1: Expected Behavior** - Code Abstraction
    - Re-run test from step 1.10
    - **EXPECTED OUTCOME**: Test PASSES (confirms abstraction complete)
    - _Requirements: 2.10_
  
  - [ ] 14.4 Verify preservation tests still pass
    - **Property 2: Preservation** - All Functionality Unchanged
    - Re-run ALL preservation tests 2.1-2.12
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)

## Phase 7: Final Verification

- [ ] 15. Checkpoint - Ensure all tests pass
  - Re-run all bug condition tests (1.1-1.12) - all should PASS
  - Re-run all preservation tests (2.1-2.12) - all should PASS
  - Verify performance improvements with metrics:
    - Auth sync: fetchSongs() calls reduced
    - Bible search: No duplicate API calls
    - Race conditions: No post-unmount operations
    - Setlist loading: Queries reduced from N to 1
    - Background fetch: Supabase calls reduced with cache
    - Profile fetch: Calls reduced from 2 to 1
    - Chapter navigation: API calls reduced with cache
    - Filter changes: Execution time reduced with indexes
  - Ask user if questions arise or if additional testing needed
