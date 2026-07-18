---
name: Saadhya Technical Portfolio
description: A precise engineering workbench for shipped systems, AI tools, and web products.
colors:
  signal-orange: "#ff6b35"
  workbench-black: "#0b0d10"
  surface-low: "#111419"
  surface-raised: "#171b21"
  ink-primary: "#edf1f5"
  ink-secondary: "#b8c0ca"
  ink-muted: "#7e8996"
  line-subtle: "#2a3038"
  line-strong: "#3b444f"
typography:
  display:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "clamp(3rem, 7vw, 5.75rem)"
    fontWeight: 750
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "clamp(1.6rem, 3vw, 2.35rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Onest, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, Consolas, monospace"
    fontSize: "0.76rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  xs: "4px"
  sm: "5px"
  md: "6px"
  lg: "10px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  action-primary:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.workbench-black}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "46px"
  action-secondary:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 18px"
    height: "46px"
  navigation-link:
    backgroundColor: "{colors.workbench-black}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "44px"
  artifact-frame:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "0"
---

# Design System: Saadhya Technical Portfolio

## Overview

**Creative North Star: "The Engineering Workbench"**

The interface should feel like a carefully maintained workspace where active builds are visible, labels are useful, and every control has a clear job. It is technical without imitating a movie terminal. Dense information is welcome when alignment, contrast, and hierarchy keep it legible.

The system combines a dark tonal foundation, one signal-color accent, direct project imagery, and a restrained mix of humanist sans-serif type with monospace metadata. The visual voice is precise, cerebral, and slightly playful.

**Key Characteristics:**
- Actual projects appear before decorative claims.
- Crisp borders and tonal layers organize information.
- Orange marks action, live state, and focus.
- Monospace is reserved for technical metadata.
- Motion responds to interaction instead of decorating every element.

## Colors

The palette is a dark workbench with cool neutral ink and a single orange signal color.

### Primary
- **Signal Orange:** Reserved for primary actions, focus outlines, live indicators, and small moments of emphasis.

### Neutral
- **Workbench Black:** The page foundation.
- **Low Surface:** Navigation controls, secondary actions, and artifact frames.
- **Raised Surface:** Hover and active layers.
- **Primary Ink:** Headings and high-priority labels.
- **Secondary Ink:** Body copy and navigation.
- **Muted Ink:** Metadata only. Never use it for essential instructions.
- **Subtle Line:** Section dividers and quiet boundaries.
- **Strong Line:** Interactive boundaries and framed artifacts.

### Named Rules

**The Signal Rule.** Orange occupies less than ten percent of a page. Its scarcity makes state and action obvious.

**The Tonal Rule.** Depth comes from neighboring dark surfaces and crisp lines. Do not solve hierarchy by adding translucent glass panels.

## Typography

**Display Font:** Onest with Arial fallback  
**Body Font:** Onest with Arial fallback  
**Label/Mono Font:** JetBrains Mono with Consolas fallback

**Character:** Onest supplies a clear, human technical voice. JetBrains Mono identifies metadata, build state, and implementation details without taking over the page.

### Hierarchy
- **Display:** Heavy, tightly spaced, and reserved for the owner's name.
- **Headline:** Strong section headings with clear contrast from body copy.
- **Title:** Medium-weight project and navigation titles.
- **Body:** Comfortable reading rhythm with a maximum measure near 65 characters.
- **Label:** Compact monospace for metadata and live-state information.

### Named Rules

**The Mono Boundary Rule.** Monospace never carries paragraphs or primary navigation. It labels the work; it does not become the work.

## Elevation

The system is flat by default. Borders, surface tones, and spacing create structure. Shadows appear only on a featured artifact or as direct feedback to interaction.

### Shadow Vocabulary
- **Signal Offset:** A hard, low-opacity orange offset behind the featured build. Use once per page.

### Named Rules

**The Flat-at-Rest Rule.** Ordinary controls and rows have no shadow. If every surface floats, nothing has hierarchy.

## Components

### Buttons
- **Shape:** Compact, gently squared corners.
- **Primary:** Signal Orange background with dark text and a strong border.
- **Secondary:** Low Surface background with Primary Ink and a Strong Line border.
- **Hover / Focus:** A two-pixel rise on hover and a visible orange outline on keyboard focus.

### Cards / Containers
- **Corner Style:** Featured media may use the large radius. Lists remain flat.
- **Background:** Low Surface or Raised Surface only.
- **Shadow Strategy:** Only the featured build receives the Signal Offset.
- **Border:** One-pixel Strong Line around framed artifacts.
- **Internal Padding:** Use the spacing scale; related metadata stays compact.

### Navigation
- The desktop header uses a three-column alignment: identity, centered route links, and contact action.
- Links have a 44-pixel minimum target, no permanent filled background, and a tonal hover state.
- On narrow screens, the route links occupy a full second row instead of compressing or overflowing.

### Featured Artifact
- A real product screenshot is mandatory.
- A compact metadata bar identifies the build and live state.
- Hover reveals the destination and slightly sharpens the image.

### Work Rows
- Selected projects render as full-width rows rather than interchangeable cards.
- Each row contains a name, concise evidence-based summary, category metadata, and destination arrow.
- Mobile layouts move the summary beneath the project name.

## Do's and Don'ts

### Do:
- **Do** show shipped projects and source links before decorative status information.
- **Do** align headers and page sections to one shared content width.
- **Do** use Signal Orange only for meaningful action and state.
- **Do** provide 44-pixel touch targets and visible keyboard focus.
- **Do** use real project screenshots with descriptive alt text.

### Don't:
- **Don't** use generic portfolio grids made from interchangeable icon cards.
- **Don't** use generic SaaS landing pages with filler copy and ornamental gradients.
- **Don't** use fake hacker-terminal cosplay, noisy scanlines, arbitrary system metrics, or commands that do not help navigation.
- **Don't** use corporate résumé-template styling that removes personality.
- **Don't** use excessive animation or decorative effects that compete with the work.
- **Don't** use gradient text, decorative glassmorphism, or repeated tiny uppercase eyebrows.
