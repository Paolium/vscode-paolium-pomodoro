# Changelog

## v3.1.0
### Fixed
- Notes no longer lose their size when reopening the panel or adding a new note (the previous resize logic used to shrink every note a little more each time)
- A note's color no longer changes when the note is reordered
### Changed
- Notes now use a fixed size and auto-arrange into a responsive grid (like rows/columns) instead of free positioning, so they never overlap when the window is resized
- Notes can be reordered by dragging one card over another; displaced cards slide into place with a lightweight animation
### Removed
- Manual free-form drag/resize positioning for notes, replaced by the auto-arranging grid above

## v3.0.0
### Added
- Timer / Notes tab switcher in the header, replacing the separate history, time-by-day, and notes-toggle icons
- Freeform notes canvas: notes can be dragged and resized anywhere, with position and size remembered
- Quick "add note" button in the Notes tab
- Compact floating Time by Day widget shown while on the Timer tab
### Changed
- Focus and break phases now always transition into each other automatically
- Sticky notes use a more solid, opaque background for better readability
### Removed
- Session History panel and per-session browsing/deletion
- Auto-start breaks/focus settings (this behavior is now always on)

## v2.1.0
### Added
- Color picker for sticky notes, using the app's own theme colors as the palette

## v2.0.0
### Added
- Persistent sticky notes panel, always visible alongside the timer, independent of any session (up to 20 notes, autosaved as you type)
- Notes trash bin with 30-day retention, per-note restore/delete, and a 50-item cap
- Button to hide/show the notes panel
### Changed
- Replaced the free-form session notes field with the sticky notes panel
- Background themes now use flat, solid colors instead of gradients/blur, for a lighter and more consistent look
- Session history capped at the 200 most recent sessions
- Simplified command titles and window/panel titles

## v1.1.0
### Added
- Stop button to end a session immediately, saving it to history regardless of remaining rounds
### Fixed
- Resetting a session no longer clears the title, tag, or notes

## v1.0.0
### Initial Release
- Customizable focus sessions and breaks
- Ambient background themes
- Status bar integration
- Sound alerts

---

**Author:** Ing. Christian Gómez Simón  
**Publisher:** Paolium