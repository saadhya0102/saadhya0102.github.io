# Personal site design

The homepage, resume, and Problem-Setting page use the original Linux terminal theme: black backgrounds, high-contrast monochrome text, JetBrains Mono, terminal title bars, command-style links, and restrained scanlines.

- `terminal.css` holds the shared homepage and Problem-Setting styles.
- The resume retains its original inline terminal styles and print layout.
- Keep the corrected resume content from the supplied LaTeX resume, including the updated achievements.
- The main routes are Resume, Books, Problem-Setting, and Projects. Display the new route as Problem-Setting, never Psetter.
- Books and projects retain their existing layouts. StudyBuddy stays at the end of project lists.
- `personal.css` is used by the local problem editor only.
- Preserve responsive layouts, visible focus states, semantic navigation, and reduced-motion support.
