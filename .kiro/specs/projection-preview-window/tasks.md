# Implementation Plan: Projection Preview Window

## Overview

This implementation adds a fixed preview window at the bottom of the main application that displays real-time projection content. The preview synchronizes with the projection window via BroadcastChannel, supports collapsible UI, and maintains visual consistency with the application theme.

## Tasks

- [x] 1. Create ProjectionPreview component structure
  - Create `src/components/ProjectionPreview.tsx` with basic component skeleton
  - Define local state interface (isCollapsed, projectionState)
  - Implement localStorage persistence helpers (loadCollapsedState, saveCollapsedState)
  - Add error handling for localStorage access failures
  - _Requirements: 4.5, 4.6_

- [ ]* 1.1 Write property test for collapsed state persistence
  - **Property 4: Collapsed state persistence round-trip**
  - **Validates: Requirements 4.5, 4.6**

- [x] 2. Implement BroadcastChannel subscription and state synchronization
  - Subscribe to 'proclama-projection' BroadcastChannel on component mount
  - Implement handleProjectionUpdate to process PROJECTION_UPDATE messages
  - Add fallback to useProjectionStore when BroadcastChannel unavailable
  - Implement state validation (validateProjectionState helper)
  - Add cleanup/unsubscribe on component unmount
  - _Requirements: 6.1, 6.2, 6.3_

- [ ]* 2.1 Write property test for projection state synchronization
  - **Property 2: Projection state synchronization**
  - **Validates: Requirements 1.1, 6.2**

- [ ]* 2.2 Write property test for projection state changes
  - **Property 6: Projection state changes trigger preview updates**
  - **Validates: Requirements 6.4, 6.5, 6.6**

- [x] 3. Build preview header with collapse toggle
  - Implement preview header with song title display
  - Add collapse toggle button with chevron icon (up when expanded, down when collapsed)
  - Wire toggle button to toggleCollapse handler
  - Persist collapsed state to localStorage on toggle
  - Display slide indicator in header (format: "N / Total")
  - _Requirements: 4.1, 4.2, 4.4, 4.7, 5.6, 8.1, 8.2, 8.3, 8.4_

- [ ]* 3.1 Write property test for collapse toggle round-trip
  - **Property 3: Collapse toggle round-trip**
  - **Validates: Requirements 4.2, 4.4**

- [ ]* 3.2 Write property test for collapse toggle icon state
  - **Property 13: Collapse toggle icon state**
  - **Validates: Requirements 4.7**

- [ ]* 3.3 Write property test for slide indicator formatting
  - **Property 8: Slide indicator formatting**
  - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ]* 3.4 Write property test for song title header display
  - **Property 14: Song title header display**
  - **Validates: Requirements 5.6**

- [x] 4. Implement slide content rendering
  - Create renderSlideContent method to display current slide
  - Render slide text lines with theme styling (font, color, shadow)
  - Apply background rendering (color, image, video, gradient)
  - Implement hideText conditional rendering (hide text when hideText is true)
  - Handle empty state when no slides are loaded
  - Scale content proportionally using CSS transforms
  - _Requirements: 1.2, 1.3, 1.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]* 4.1 Write property test for hideText conditional rendering
  - **Property 5: HideText conditional rendering**
  - **Validates: Requirements 1.5**

- [ ]* 4.2 Write property test for projection state content consistency
  - **Property 15: Projection state content consistency**
  - **Validates: Requirements 1.2**

- [x] 5. Implement media content display
  - Render image media with error handling
  - Render video media as static preview (no playback controls)
  - Add onError handlers for failed media loads
  - Display fallback background on media load failure
  - _Requirements: 1.4, 7.3, 7.4_

- [ ]* 5.1 Write property test for media content display
  - **Property 7: Media content display**
  - **Validates: Requirements 1.4**

- [x] 6. Implement countdown timer display
  - Create renderCountdownContent method
  - Implement formatTime helper (MM:SS format with zero-padding)
  - Display countdown title when config.title is non-empty
  - Render countdown timer with remaining time
  - Apply countdown theme styling
  - Handle countdown status states (running, paused, finished, idle)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ]* 6.1 Write property test for countdown timer formatting
  - **Property 9: Countdown timer formatting**
  - **Validates: Requirements 9.3**

- [ ]* 6.2 Write property test for countdown conditional rendering
  - **Property 10: Countdown conditional rendering**
  - **Validates: Requirements 9.1, 9.4, 9.5, 9.6**

- [ ]* 6.3 Write property test for countdown title conditional display
  - **Property 11: Countdown title conditional display**
  - **Validates: Requirements 9.2**

- [x] 7. Add CSS styling for preview component
  - Add `.projection-preview` base styles to `src/index.css`
  - Implement collapsed/expanded height transitions (40px collapsed, 200px expanded)
  - Style preview header with dark background and gold accents
  - Style preview content viewport with 16:9 aspect ratio
  - Add fixed positioning at bottom with appropriate z-index
  - Implement responsive height adjustment for small viewports (<768px)
  - Add border-top and subtle shadow for visual separation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.3, 5.1, 5.2, 5.3, 10.6_

- [ ]* 7.1 Write property test for aspect ratio maintenance
  - **Property 12: Aspect ratio maintenance**
  - **Validates: Requirements 1.6**

- [x] 8. Integrate ProjectionPreview into App.tsx
  - Import ProjectionPreview component in App.tsx
  - Add ProjectionPreview as sibling to Sidebar, main content, and ControlPanel
  - Ensure preview is NOT rendered when IS_PROJECTION is true
  - Add padding-bottom to main content to prevent overlap with preview
  - Adjust layout for sidebar collapsed state
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.6, 10.1, 10.2, 10.4, 10.5_

- [ ]* 8.1 Write property test for preview visibility across all views
  - **Property 1: Preview visibility across all views**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

- [x] 9. Checkpoint - Ensure all tests pass
  - Run all unit tests and property-based tests
  - Verify preview displays correctly in all views
  - Test collapse/expand functionality
  - Verify BroadcastChannel synchronization
  - Ensure all tests pass, ask the user if questions arise

- [ ]* 10. Write unit tests for edge cases and integration
  - Test component renders without crashing
  - Test empty state when no song loaded (Requirement 1.3)
  - Test slide indicator hidden when no slides (Requirement 8.5)
  - Test BroadcastChannel subscription on mount (Requirement 6.1)
  - Test cleanup/unsubscribe on unmount
  - Test preview not visible in projection window (Requirement 2.8)
  - Test localStorage error handling (graceful degradation)
  - Test invalid ProjectionState handling
  - Test media loading error handling
  - Test invalid countdown time handling (negative, NaN)

- [x] 11. Performance optimization
  - Add React.memo to ProjectionPreview component
  - Implement debouncing for rapid state updates
  - Optimize re-render triggers using useCallback and useMemo
  - Verify video media uses static preview (no playback)
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 12. Final checkpoint - Manual testing and verification
  - Test visual consistency with projection window across themes
  - Verify smooth collapse/expand animation
  - Test real-time updates when projection changes
  - Verify no performance degradation with preview visible
  - Test responsive behavior at different screen sizes
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- BroadcastChannel provides synchronization without additional state management
- Component uses existing ProjectionState and CountdownState types from `src/types/index.ts`
