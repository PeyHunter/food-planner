# 0002 Design: Sticker pop

Date: 2026-11-14. Status: accepted. Replaces the pick in [0001](0001-design.md). Decided by the user.

After seeing the five designs, the user picked **4, Sticker pop** over 0001's pick (1, Fresh market). Notes: `docs/design-feedback-2026-11-14.md`.

The look: a white page with a dot grid, chunky ink outlines, hard offset shadows, bright coloured day tiles, tilted sticker tags and chunky buttons that press down.

Borrowed from design 3 (Modern cookbook), drawn in Sticker pop style:

- **Browse** uses design 3's "Flip through the book" layout: a stack of recipe pages, a big dish photo, a page counter ("p. 12 / 48"), swipe to the next page, type filter chips and a big "Add to week" button.
- **Week** uses design 3's richer day cards (dish photo, main type and tags, people count, "next up" on today, the child's meal line) and its rules card at the top (adults and each child side by side).

Build rule: take tokens and component shapes from `prototypes/design/4/styles.css` into `src/web/styles.css`. Keep all colours and type in tokens. The bottom nav has four tabs: Recipes, Week, Shopping, Runi & kids.

0001 called Sticker pop "too loud for daily use". To keep it calm, bright fills go on small things (tags, day tiles, the active tab) and big surfaces stay white or soft tints.
