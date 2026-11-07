# food-planner spec

A meal planner and recipe book for Peyton and Ronja (and their baby, Runi Lee). Lives at https://food-planner.peytonhunter.com as a home-screen web app on two iPhones. English UI, metric units only. Decisions came from a grilling session on 2026-11-07.

## Users and access

- Two accounts, `peyton` and `ronja`, created at startup from env `PEYTON_PASSWORD` / `RONJA_PASSWORD` (create if missing, never overwrite a changed password). No sign-up page.
- Both share one **Kitchen**: every recipe, plan, rule and list belongs to the kitchen, not a person. Record who added what.
- Model users and kitchens so friend accounts can join later (users table, kitchen_members table). Not built now.
- Stay logged in for a long time (cookie session, like LP-Collection's 400-day sessions).

## Recipes

- Title, **feeds N** (the amounts are written for N people, any N), one or more **main types** (Fish, Meat, Chicken, Vegetarian, Vegetables), free tags. Built-in tags: `freezable`, `kid-friendly`, `for Runi`.
- Ingredient lines: amount + unit + ingredient (from the shared ingredient list) + optional note ("finely chopped").
- Steps as an ordered list.
- One main dish photo plus a gallery of extra photos (ingredients, process, someone's handwritten recipe). Photos are resized on upload and stored on a volume.
- **"I made this"** logs a date on the recipe and lets you add new photos from that cook. No auto-ticking.
- **Stepper** (− N +) on the recipe page starts at the recipe's own N and scales every amount live. Not saved.

## Ingredients

- One shared ingredient list per kitchen, so "carrot" and "carrots" are the same thing. Typing suggests existing ones; new ones get added.
- Each ingredient has a **shop section**: Vegetables, Dairy, Meat & fish, Dry goods, Frozen, Other (list order).
- Optional **pack size** (amount + unit, e.g. 1 kg, 1 l, 5 pcs), filled in the first time it matters.
- Optional **always at home** flag (salt, oil, pepper): never on the shopping list.

## Units and rounding

- Units: g, kg, ml, dl, l, tsp, tbsp, pcs. Convert only within one kind (mass, volume, spoon-volume to volume is allowed, pieces never convert).
- Scaling rounds **up**: pcs to a whole number (¾ onion becomes 1), g and ml to a tidy step (5 below 100, 25 below 1000, 50 above), tsp and tbsp to the nearest half.

## Browse

- One big dish photo at a time with its title, swipe left/right like LP-Collection's `src/web/BrowseScreen.tsx` crate.
- Filter first by main type and tags. "Add to week" picks a day.
- A plain list or grid view of recipes with search too.

## Week plan

- Monday to Sunday, one **dinner** per day. You can browse to other weeks.
- Each day has a **people count**, default 2 adults (Runi Lee is planned in her own row). Setting Wednesday to 5 scales that dinner and the shopping list.
- Slot holds a recipe or is empty.
- **Runi Lee row**: one meal a day. Slot holds a Runi recipe (tag `for Runi`) or "Same as dinner, mashed" (adds a small portion: count it as +0.5 person on that dinner).
- **Rules**: "at least / at most N per week with main type or tag X". Two rule sets: adults and Runi Lee. Defaults. Adults: Fish ≥ 1, Freezable ≥ 1. Runi Lee: Fish ≥ 2, Meat ≤ 1, Vegetables ≥ 5. Shown on the week screen as a checklist (tick when met, gentle warning when not). A dish with several main types counts for each.

## Shopping list

- Built from the chosen days (default: rest of the current week) and each day's people count.
- Adds up the same ingredient across dinners (after unit conversion), rounds up to whole packs when a pack size exists, and shows the leftover ("600 g carrots left").
- Grouped by shop section in the fixed order. Hides "always at home" items.
- Tick items off in the shop. Add extra items ("milk"). Updates live on both phones (poll every few seconds or SSE).

## Sharing

- Share button opens the iPhone share sheet with a link. Anyone with the link sees that one recipe read-only, with photos and the stepper. No login. Links can be turned off.

## After version 1, in order

1. **Create week**: fills only empty days, follows both rule sets, skips dishes made in the last 14 days, prefers dishes that use up leftover packs. Plain code, deterministic, no AI.
2. **Reduce waste** button: looks at the planned week and gently suggests a swap ("Swap Thursday for X to use the 600 g carrots left from Monday"). Plain code.
3. **Photo to recipe**: take a photo of a written recipe, the Anthropic API (key in `ANTHROPIC_API_KEY`) fills in title, ingredients, steps for review before saving.
4. **Freezer**: log "6 portions in the freezer" after a freezable cook; plan a night as "from the freezer" (decrements, adds nothing to the shopping list).

## Design

Before building screens: at least 5 competing designs (arena), each using the good-css skill (copy `~/lp-collection/.claude/skills/good-css` into this repo). Style: light, modern, slightly playful. Each design covers Browse, Recipe and Week. Put screenshots of all of them side by side in one Artifact page. The manager picks the winner (the user delegated this) and records why in `docs/adr/`. The user may ask for a swap later.

## Stack and deploy

Same stack as LP-Collection (`~/lp-collection`): TypeScript, React + Vite, a Node server, Drizzle + Postgres, Vitest, Playwright. One container image `ghcr.io/peyhunter/food-planner`.

Deploy like tech-update (`~/tech-update/deploy`, `.github/workflows`): Argo CD app `food-planner` (already in k3s-gitops) syncs this repo's `deploy/` folder into namespace `food-planner`. Traefik ingress with cert-manager, and external-dns makes the DNS record. CI builds the image and bumps the tag in `deploy/kustomization.yaml`.

Secret `food-planner-secrets` (already sealed and live) has keys `POSTGRES_PASSWORD`, `SESSION_SECRET`, `PEYTON_PASSWORD`, `RONJA_PASSWORD`, `ANTHROPIC_API_KEY`. Never commit secrets: the repo is public.

The cluster is small (k3s-1 has 2 CPU and 3.7 GiB with ~63% RAM used). Keep requests low. Storage is local-path. kubectl only works over `ssh peyton@100.96.98.57` with `export KUBECONFIG=$HOME/.kube/config`. Reading cluster secrets is refused by auto mode, so don't try.
