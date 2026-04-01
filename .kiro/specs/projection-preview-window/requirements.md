# Requirements Document

## Introduction

This feature adds a fixed preview window at the bottom of the application that displays real-time projection content. The preview allows operators to see what is currently being projected without switching views or opening the projection window. This improves workflow efficiency and reduces errors during live presentations.

## Glossary

- **Preview_Window**: The fixed UI component at the bottom of the main application that displays projection content
- **Projection_State**: The current state of the projection including slides, theme, media, and active slide index
- **Main_Application**: The primary application window containing Library, Setlists, Bible, Settings, and other views
- **Projection_Window**: The separate fullscreen window that displays content on the projector or second screen
- **BroadcastChannel**: The browser API used for communication between windows via the 'proclama-projection' channel
- **Control_Panel**: The existing right panel component that contains projection controls
- **Slide_Content**: The text, background, styling, and media displayed on a projection slide
- **Collapse_Toggle**: A UI control that allows showing or hiding the Preview_Window

## Requirements

### Requirement 1: Display Real-Time Projection Content

**User Story:** As a worship leader, I want to see what is currently being projected in real-time, so that I can verify the correct content is displayed without looking at the projector screen.

#### Acceptance Criteria

1. WHEN Projection_State changes, THE Preview_Window SHALL update within 100ms to display the current slide content
2. THE Preview_Window SHALL display the same Slide_Content as the Projection_Window including text, background, and styling
3. WHEN no song is loaded, THE Preview_Window SHALL display an empty state indicator
4. WHEN media is being projected, THE Preview_Window SHALL display the media content (image or video)
5. WHEN hideText is enabled, THE Preview_Window SHALL hide text content while showing background and media
6. THE Preview_Window SHALL maintain aspect ratio matching the projection display (16:9)

### Requirement 2: Global Visibility Across All Views

**User Story:** As an operator, I want the preview window to be visible from any view in the application, so that I can monitor projection content while managing songs, setlists, or Bible verses.

#### Acceptance Criteria

1. THE Preview_Window SHALL be visible when activeView is 'library'
2. THE Preview_Window SHALL be visible when activeView is 'editor'
3. THE Preview_Window SHALL be visible when activeView is 'setlists'
4. THE Preview_Window SHALL be visible when activeView is 'bible'
5. THE Preview_Window SHALL be visible when activeView is 'settings'
6. THE Preview_Window SHALL be visible when activeView is 'countdown'
7. THE Preview_Window SHALL be visible when activeView is 'notes'
8. THE Preview_Window SHALL NOT be visible in the Projection_Window itself

### Requirement 3: Fixed Positioning at Bottom of Screen

**User Story:** As an operator, I want the preview window to stay at the bottom of the screen, so that it doesn't interfere with my main workflow but remains easily visible.

#### Acceptance Criteria

1. THE Preview_Window SHALL be positioned at the bottom of the Main_Application viewport
2. THE Preview_Window SHALL remain fixed during scrolling of main content
3. THE Preview_Window SHALL span the full width of the Main_Application
4. THE Preview_Window SHALL have a maximum height of 200 pixels when expanded
5. THE Preview_Window SHALL appear above the main content layer with appropriate z-index
6. WHEN the sidebar is collapsed, THE Preview_Window SHALL adjust its width to fill the available space

### Requirement 4: Collapsible Interface

**User Story:** As an operator, I want to collapse or expand the preview window, so that I can maximize screen space when I don't need to monitor projection content.

#### Acceptance Criteria

1. THE Preview_Window SHALL include a Collapse_Toggle control
2. WHEN the Collapse_Toggle is clicked, THE Preview_Window SHALL collapse to show only a minimal header bar
3. WHEN collapsed, THE Preview_Window SHALL have a maximum height of 40 pixels
4. WHEN the Collapse_Toggle is clicked while collapsed, THE Preview_Window SHALL expand to full preview size
5. THE Preview_Window SHALL persist the collapsed/expanded state in local storage
6. WHEN the application loads, THE Preview_Window SHALL restore the previous collapsed/expanded state
7. THE Collapse_Toggle SHALL display an appropriate icon indicating the current state (chevron up when expanded, chevron down when collapsed)

### Requirement 5: Visual Consistency with Application Theme

**User Story:** As a user, I want the preview window to match the application's visual style, so that it feels like a natural part of the interface.

#### Acceptance Criteria

1. THE Preview_Window SHALL use the dark theme background color (#060810 or similar)
2. THE Preview_Window SHALL use gold accent colors (var(--gold)) for interactive elements
3. THE Preview_Window SHALL include a subtle border or shadow to separate it from main content
4. THE Preview_Window SHALL use the application's standard font family and sizing
5. THE Preview_Window SHALL display text with appropriate contrast ratios for readability
6. THE Preview_Window header SHALL display the current song title or content type

### Requirement 6: Projection State Synchronization

**User Story:** As an operator, I want the preview to stay synchronized with the projection window, so that I always see accurate information about what is being displayed.

#### Acceptance Criteria

1. THE Preview_Window SHALL subscribe to BroadcastChannel messages of type 'PROJECTION_UPDATE'
2. WHEN a 'PROJECTION_UPDATE' message is received, THE Preview_Window SHALL update its display state
3. THE Preview_Window SHALL read Projection_State from useProjectionStore
4. WHEN Projection_State.currentSlide changes, THE Preview_Window SHALL display the new slide
5. WHEN Projection_State.theme changes, THE Preview_Window SHALL apply the new theme styling
6. WHEN Projection_State.media changes, THE Preview_Window SHALL display or hide media content accordingly

### Requirement 7: Performance and Resource Efficiency

**User Story:** As a user, I want the preview window to run efficiently, so that it doesn't slow down the application or consume excessive resources.

#### Acceptance Criteria

1. THE Preview_Window SHALL render using CSS transforms for smooth animations
2. THE Preview_Window SHALL debounce rapid state updates to prevent excessive re-renders
3. WHEN video media is displayed, THE Preview_Window SHALL use a lightweight preview (thumbnail or low-resolution stream)
4. THE Preview_Window SHALL not execute video playback controls (videos remain static previews)
5. THE Preview_Window SHALL use React.memo or similar optimization to prevent unnecessary re-renders
6. THE Preview_Window SHALL have a maximum memory footprint of 50MB

### Requirement 8: Slide Navigation Indicator

**User Story:** As an operator, I want to see which slide is currently active and how many slides are in the presentation, so that I can track progress through the content.

#### Acceptance Criteria

1. THE Preview_Window SHALL display the current slide number (currentSlide + 1)
2. THE Preview_Window SHALL display the total number of slides
3. THE Preview_Window SHALL format the indicator as "N / Total" (e.g., "3 / 5")
4. THE Preview_Window SHALL position the indicator in a non-intrusive location (corner or header)
5. WHEN no slides are loaded, THE Preview_Window SHALL hide the slide indicator

### Requirement 9: Countdown Timer Display

**User Story:** As an operator, I want to see countdown timers in the preview window, so that I can monitor time-based presentations without switching views.

#### Acceptance Criteria

1. WHEN a countdown is active, THE Preview_Window SHALL display the countdown timer
2. THE Preview_Window SHALL display the countdown title if configured
3. THE Preview_Window SHALL display the remaining time in MM:SS format
4. THE Preview_Window SHALL apply the countdown theme styling to the preview
5. WHEN the countdown finishes, THE Preview_Window SHALL display the finished state
6. WHEN the countdown is idle, THE Preview_Window SHALL display regular projection content

### Requirement 10: Responsive Layout Integration

**User Story:** As a user, I want the preview window to integrate smoothly with the existing layout, so that it doesn't break the application's responsive design.

#### Acceptance Criteria

1. THE Preview_Window SHALL adjust its layout when the Control_Panel is visible
2. THE Preview_Window SHALL adjust its layout when the sidebar is collapsed
3. THE Preview_Window SHALL maintain readability on screens with minimum width of 1024 pixels
4. THE Preview_Window SHALL not overlap with the Control_Panel
5. THE Preview_Window SHALL not overlap with the Sidebar
6. WHEN the viewport height is less than 768 pixels, THE Preview_Window SHALL reduce its maximum height to 150 pixels
