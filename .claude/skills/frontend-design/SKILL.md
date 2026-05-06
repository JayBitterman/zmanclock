---
name: frontend-design
description: Use when building UI components, pages, layouts, or styling anything for the web. Covers React, HTML/CSS, responsive design, and visual polish.
---

# Frontend Design Skill

## Before Writing Any Code
1. Clarify the target: component, page, full app?
2. Identify the stack from CLAUDE.md (React? plain HTML? Tailwind? CSS modules?)
3. Check if a design system or component library is already in use in the project

## Design Principles
- **Mobile-first**: Start with mobile layout, scale up with media queries or responsive utilities
- **Semantic HTML**: Use proper elements (`<nav>`, `<main>`, `<section>`, `<article>`, `<button>` not `<div onclick>`)
- **Accessibility by default**: Labels on inputs, alt text on images, keyboard navigation, sufficient color contrast
- **Consistent spacing**: Pick a spacing scale and stick to it (e.g., 4px/8px/16px/24px/32px/48px)

## Typography
- Limit to 2 fonts max: one display, one body
- Establish a clear type scale: don't randomly pick font sizes
- Line height ~1.5 for body text, ~1.2 for headings

## Color
- Use CSS variables or Tailwind config for all colors
- Define a palette: primary, secondary, neutral, error, success
- Test contrast ratios — WCAG AA minimum (4.5:1 for normal text)

## Component Patterns
- Keep components small and focused (single responsibility)
- Props for configuration, not hardcoded values
- Handle loading, empty, and error states — not just the happy path
- Use controlled components for forms

## CSS Approach (adapt to project)
- **Tailwind**: Use utility classes, extract components with `@apply` sparingly
- **CSS Modules**: Co-locate `.module.css` with component files
- **Styled-components**: Keep styles in the same file as the component
- Avoid inline styles except for truly dynamic values

## Responsive Breakpoints (common defaults)
- sm: 640px, md: 768px, lg: 1024px, xl: 1280px
- Always test: does it look right at 320px? At 1920px?

## Performance
- Lazy load images and heavy components
- Avoid layout shift — set explicit dimensions on images/media
- Minimize re-renders: memoize expensive computations, use `useCallback`/`useMemo` appropriately (not everywhere)

## Common Gotchas
- Don't forget `:focus-visible` styles when customizing focus
- `overflow: hidden` can clip box shadows and dropdown menus
- z-index wars: establish a z-index scale in your design tokens
- Test in both light and dark mode if the project supports it
