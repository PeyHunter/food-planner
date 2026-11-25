# food-planner spec

A meal planner and recipe book for Peyton and Ronja (and their baby, Runi Lee). Lives at https://food-planner.peytonhunter.com as a home-screen web app on two iPhones. English UI, metric units only. Decisions came from a grilling session on 2026-11-07.

## Users and access

- Two accounts, `peyton` and `ronja`, created at startup from env `PEYTON_PASSWORD` / `RONJA_PASSWORD` (create if missing, never overwrite a changed password). No sign-up page.
- Both share one **Kitchen**: every recipe, plan, rule and list belongs to the kitchen, not a person. Record who added what.
- Kitchens without kids, one or two logins each: `isabel` + `christopher`, `magnus` + `mads`, and `marieke` on her own (env `<NAME>_PASSWORD`, a kitchen is made only when all its passwords are set; every kitchen is listed in `kitchenConfigs`, src/server/kitchens-config.ts, as `{ logins, kids, language }`). They have no kids: no Runi & kids tab, no child meals or child rules, no kid tags or age ranges in the recipe form. Each kitchen only sees its own recipes, weeks and lists.
- A kitchen with kids for `valdemar` + `anna`, with their children Vilje and Konrad (not Runi Lee), in Danish. Birthdays are unknown at start: they are left empty and the Runi & kids tab asks for them. New logins are added with `scripts/add-logins.sh <name>...` on k3s-1 (seals only the named passwords into the existing sealed secret).
- **Starter recipes**: a new kitchen gets 15 everyday Danish family dinners (3 fish, some vegetarian, metric) once, in its language. An empty recipe list shows an "Add 15 starter recipes" button. Their ingredients reuse the kitchen's by name.
- **AI usage**: every Claude API call is saved in `ai_calls` (kitchen, user, feature, model, tokens, cost in dollars from one price table in src/server/ai-calls.ts). `scripts/usage-report.sql` shows the last 30 days per kitchen and login.
- Stay logged in for a long time (cookie session, like LP-Collection's 400-day sessions).
- **Safer logins** (docs/security-and-nemlig.md): passkeys (Face ID / fingerprint) added on Profile and used on the login screen; the password stays as a fallback. At most 10 failed logins per name and per address in 15 minutes (kept in Postgres). Profile lists **Devices** (log out one, or everywhere else), **Passkeys** and the last 20 **Activity** entries. Changing passkeys, and later anything nemlig.com, asks "Confirm it's you" (passkey, or password when you have none) unless you did so in the last 5 minutes (`requireRecentAuth` in src/server/step-up.ts).
- Per-person secrets (the nemlig.com login) are sealed with AES-256-GCM in `secrets` (src/server/secrets.ts); the key is `APP_SECRET_KEY`, made once with `scripts/add-app-key.sh` on k3s-1. Without it the app runs and the nemlig.com login stays off. The app never asks for or stores card details.

## Recipes

- Title, a short **description** (a few lines about the dish), optional **time** in minutes (shown as "45 min" or "1 h 15 min"), **feeds N** (the amounts are written for N people, any N), one or more **main types** (Fish, Meat, Chicken, Vegetarian, Vegetables), free tags. Built-in tags: `freezable`, `kid-friendly`, `for Runi`.
- Ingredient lines: amount + unit + ingredient (from the shared ingredient list) + optional note ("finely chopped").
- Steps as an ordered list.
- One main dish photo plus a gallery of extra photos (ingredients, process, someone's handwritten recipe). Photos are resized on upload and stored on a volume.
- **"I made this"** logs a date on the recipe and lets you add new photos from that cook. No auto-ticking.
- **Stepper** (− N +) on the recipe page starts at the recipe's own N and scales every amount live. Not saved.

## Ingredients

- One shared ingredient list per kitchen, so "carrot" and "carrots" are the same thing. Typing suggests existing ones; new ones get added.
- Each ingredient has a **shop section**: Vegetables, Bread, Dairy, Meat & fish, Dry goods, Tins & jars, Spices & sauces, Frozen, Drinks, Other (list order). A new ingredient gets a guess from a table of common Danish and English groceries (src/shared/groceries.ts); the recipe form shows the guess and offers "Did you mean" fixes for names it does not know.
- Optional **pack size** (amount + unit, e.g. 1 kg, 1 l, 5 pcs), filled in the first time it matters.
- Optional **always at home** flag (salt, oil, pepper): never on the shopping list.

## Units and rounding

- Units: g, kg, ml, dl, l, pcs. Metric only: no tsp, tbsp, cups or ounces (1 tsp = 5 ml, 1 tbsp = 15 ml). Convert only within one kind (mass or volume; pieces never convert).
- Scaling rounds **up**: pcs to a whole number (¾ onion becomes 1), g and ml to a tidy step (1 below 10, 5 below 100, 25 below 1000, 50 above).

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

## Feedback 2026-11-14 (overrides anything above that disagrees)

From the user after seeing the designs. Full notes in `docs/design-feedback-2026-11-14.md`.

- **Look**: Sticker pop (design 4): white dot grid, chunky ink outlines, bright coloured day tiles, tilted sticker tags.
- **Browse** uses design 3's "Flip through the book" layout in the Sticker pop style: a stack of recipe pages, big dish photo, page counter ("p. 12 / 48"), swipe to the next page, type filter chips, a big "Add to week" button.
- **Week** shows more per day, like design 3: a **rules card at the top** with Adults and each child side by side (a tick or "1/2" per rule, and "2 to go" when rules are not met), and per day the dish photo, main type and tags, people count, "next up" on today, and the child's meal line.
- **Children** are data, not a hard-coded row. A `children` table (name, birthday). Each kitchen's children are created with it (Runi Lee for Peyton and Ronja); birthdays are set in the app. The app shows each child's age ("Runi Lee, 7 months").
- **"Runi & kids" tab** (bottom nav): pick a child, see age, birthday, her recipes and her rules. Child recipes carry an **age range in months** (e.g. 6–12). The tab lists recipes that fit the child's current age, so the same recipes work again for the next child at that age.
- **Rules are clear and editable** per adults and per child (e.g. "Runi Lee: Fish at least 2 a week"). Defaults as in Week plan above.
- **Rule check with swaps**: when the planned week misses a rule (no fish for Runi), the week screen says so in plain words and suggests swaps from recipes already in the book ("Swap Tuesday for Salmon mash to get fish 2/2"). One tap accepts. Plain deterministic code, no AI.

## After version 1, in order

1. **Create week**: fills only empty days, follows both rule sets, skips dishes made in the last 14 days, prefers dishes that use up leftover packs. Plain code, deterministic, no AI.
2. **Reduce waste** button: looks at the planned week and gently suggests a swap ("Swap Thursday for X to use the 600 g carrots left from Monday"). Plain code.
3. **Photo to recipe**: take a photo of a written recipe, the Anthropic API (key in `ANTHROPIC_API_KEY`) fills in title, description, ingredients, steps for review before saving. When a recipe book page has a printed picture of the dish, that picture is cut out and becomes the main photo; the pages go in the gallery.
4. **Freezer**: log "6 portions in the freezer" after a freezable cook; plan a night as "from the freezer" (decrements, adds nothing to the shopping list).

## Notes 2026-11-24 (overrides anything above that disagrees)

- **Home is the front page** and the default after login. It scrolls: a 2-3 column grid of every recipe, then an "Ideas" rail of dish photos. Ideas are adult food only: no child-only recipes or recipes tagged `for Runi`.
- **Suggestions sit under the weekday cards** on the Week screen, closed by default on every load.
- **Categories are open**: a kitchen can add its own (for example `rygbrødsmadder`), and they work in filters and rules beside the five built-in types.
- **What can I make?** under Recipes: type the ingredients in the kitchen and see recipes ranked by what is missing.
- **Recipe photos swipe inline** on the recipe page: the main photo and the gallery are one horizontal strip. A tap still opens the full-screen viewer.
- **Each child has her own freezer.** The Kids tab shows what is in it, what can be frozen for her (her freezable recipes), and a button to put a portion in. A child's week meal can be taken "from her freezer", which takes one portion out and adds nothing to the shopping list.
- **Two more kitchens without kids**: Anna D + Mathias and Anna A + Jacob, two logins each, made at startup when their passwords are set.
- **Breakfast and lunch** are planned, not built. `docs/plans/meal-types.md` has the data, API, UI, shopping and rules path.

## Notes 2026-11-25 (overrides anything above that disagrees)

- **One Recipes tab replaces Home.** It opens on a grid of every recipe, then the "Ideas" rail. A Grid/Book switch flips to the book view; the choice is remembered, and `#/recipes/list` always opens the grid.
- **What can I make?** now searches the web for dinners from the ingredients typed in (Valdemarsro first, then a short list of trusted recipe sites). It no longer ranks the kitchen's own recipes.
- **Child recipes live in the child's freezer, not the kitchen freezer.** In a kitchen with one child, portions of child recipes (age range or tagged `for Runi`) go in her freezer, and her freezer shows first when picking her dinner on the Week screen.

## Design

Before building screens: at least 5 competing designs (arena), each using the good-css skill (copy `~/lp-collection/.claude/skills/good-css` into this repo). Style: light, modern, slightly playful. Each design covers Browse, Recipe and Week. Put screenshots of all of them side by side in one Artifact page. The manager picks the winner (the user delegated this) and records why in `docs/adr/`. The user may ask for a swap later.

## Stack and deploy

Same stack as LP-Collection (`~/lp-collection`): TypeScript, React + Vite, a Node server, Drizzle + Postgres, Vitest, Playwright. One container image `ghcr.io/peyhunter/food-planner`.

Deploy like tech-update (`~/tech-update/deploy`, `.github/workflows`): Argo CD app `food-planner` (already in k3s-gitops) syncs this repo's `deploy/` folder into namespace `food-planner`. Traefik ingress with cert-manager, and external-dns makes the DNS record. CI builds the image and bumps the tag in `deploy/kustomization.yaml`.

Secret `food-planner-secrets` (already sealed and live) has keys `POSTGRES_PASSWORD`, `SESSION_SECRET`, `PEYTON_PASSWORD`, `RONJA_PASSWORD`, `ANTHROPIC_API_KEY`, and (optional) `APP_SECRET_KEY`. Never commit secrets: the repo is public.

The cluster is small (k3s-1 has 2 CPU and 3.7 GiB with ~63% RAM used). Keep requests low. Storage is local-path. kubectl only works over `ssh peyton@100.96.98.57` with `export KUBECONFIG=$HOME/.kube/config`. Reading cluster secrets is refused by auto mode, so don't try.
