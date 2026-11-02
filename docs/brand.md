# Ondevo brand

**Name:** Ondevo — from “on device”.
**Line:** Pro tools that run on your device.
**Promise:** Your files stay on your computer or phone. Nothing is uploaded unless you ask for a share link, and shared files delete after 2 hours.

## Personality
Private, fast, crafted, calm. Plain words, exact numbers, no hype. Say what a tool does in the words people use (“remove the hiss”), say how big a download is and how long a file is kept.

## Mark
A rounded device tile in ink navy. Inside, sound turns into text: two white waveform bars, one tangerine bar (the moment of processing), then three lines of type. File: `apps/web/public/favicon.svg`; React: `apps/web/src/components/Logo.tsx`. On dark grounds the tile turns warm white and the strokes navy.

## Colour
| Role | Hex | Use |
| --- | --- | --- |
| Ink navy | `#1F2B4D` | Text, the mark, the main data line |
| White | `#FFFFFF` | Page ground |
| Tangerine | `#F7941D` | The one primary action per screen, nothing else |
| Night | `#05070A` | Opening field, dark-mode ground |
| Warm grey | `#E3E1DC` | Closing field, the waveform slot |
| Frame | `#F3F5F8` | App frame (sidebar + top bar) around the white sheet |
| OK / Warn / Bad | `#1D7A4B` / `#8A5A00` / `#C0303A` | Status only |

Tokens live in `apps/web/src/design/tokens.css` with light and dark values.

## Type
One family, **Archivo** (variable width and weight, self-hosted).
- Display: weight 800, width 62%, capitals, leading 0.86–0.95.
- Text: weight 400, normal width, 16–19 px, leading 1.5. Labels and buttons 600.

## Layout and components
- Landing direction: “the sentence is the layout” (taste-skill seed 1086466358). Tool screens: “framed sheet”.
- Headlines never run past two lines at any width.
- Buttons are fully round; touch targets are at least 44 px on touch screens.
- No gradients, glows, glass panels, emoji, or shadows on things at rest.
- Motion uses transform and opacity only and stops for reduced-motion users.

## Imagery
Real screenshots of Ondevo’s own tools working on real test files (`apps/web/public/shots/`). Never stock “AI” art, never fake dashboards.
