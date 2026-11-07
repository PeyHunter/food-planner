# food-planner plan

Build version 1 of docs/SPEC.md and ship it to https://food-planner.peytonhunter.com, then the four follow-ups.
Users are Peyton and Ronja on two iPhones. One kitchen holds everything.
PRs in order: P1 skeleton, P2 design, P3 recipes, P4 browse, P5 week, P6 shopping, P7 share, then F1 create week, F2 reduce waste, F3 photo to recipe, F4 freezer.
Every PR ships to the live URL on merge, because CI bumps deploy/kustomization.yaml and Argo CD syncs it.

## How to read this

One box is one unit. Check a box only when its evidence exists. Runs `playbooks/autopilot.md` with merge. The manager merges each PR with `gh pr merge --squash --delete-branch` after CI is green and a separate verifier agent reports PASS. Tier std: one builder and one verifier per PR.

## PR P1: Walking skeleton

**Goal.** A live login page at the real URL, backed by Postgres, deployed by CI and Argo CD.
**Depends on.** none
**Files.** package.json, tsconfig.json, vite.config.ts, vitest.config.ts, playwright.config.ts, drizzle.config.ts, drizzle/, src/server/, src/web/, test/, e2e/, Dockerfile, .github/workflows/, deploy/

- [ ] Copy the LP-Collection stack (Hono server, React + Vite, Drizzle, embedded-postgres for tests) . evidence: npm run build
- [ ] Schema: users, kitchens, kitchen_members, sessions. Seed peyton and ronja from env, never overwrite . evidence: test/users.test.ts
- [ ] Cookie login with 400-day sessions, logout, `/api/me` . evidence: test/login.test.ts
- [ ] deploy/: namespace food-planner, postgres StatefulSet on local-path, app Deployment, photos PVC, ingress with cert-manager and https redirect, low requests . evidence: kubectl kustomize deploy
- [ ] CI: test, build ghcr.io/peyhunter/food-planner, bump deploy/kustomization.yaml on main . evidence: .github/workflows/ci.yml

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: `curl -sI https://food-planner.peytonhunter.com` and a phone-size login as peyton . saves .peystack/shots/p1-login.png . passes when status is 200 and the home screen shows after login
- [ ] Regression lane: same scenario on trunk and head (trunk has no app, so trunk is expected to fail)
- [ ] Perf: pod memory trunk 0 head <= 200 Mi
**Review gate.** None.

## PR P2: Design battle

**Goal.** Pick one look for Browse, Recipe and Week from five or more competing designs.
**Depends on.** P1
**Files.** .claude/skills/good-css/, prototypes/designs/, docs/adr/, src/web/styles.css

- [ ] Copy ~/lp-collection/.claude/skills/good-css into this repo . evidence: .claude/skills/good-css/SKILL.md
- [ ] Five or more static designs, each with Browse, Recipe and Week, light, modern, slightly playful . evidence: prototypes/designs/
- [ ] Phone-size screenshots of all designs side by side on one Artifact page . evidence: artifact link
- [ ] Pick the winner and write why . evidence: docs/adr/0001-design.md
- [ ] Winner's tokens become src/web/styles.css . evidence: styles.css

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: login page on the real URL uses the new styles . saves .peystack/shots/p2-login.png . passes when the screenshot shows the winning look
- [ ] Regression lane: same scenario on trunk and head
- [ ] Perf: CSS size trunk n head <= 30 kB
**Review gate.** The user may ask for a swap later.

## PR P3: Recipes, ingredients, photos

**Goal.** Add, edit and view recipes with scaled amounts, photos and an "I made this" log.
**Depends on.** P2
**Files.** src/server/, src/web/, drizzle/, test/, e2e/

- [ ] Schema: recipes, recipe_types, recipe_tags, ingredients (shop section, pack size, always at home), recipe_lines, steps, photos, cooks . evidence: drizzle/
- [ ] Units and rounding module with a full table of tests . evidence: test/units.test.ts
- [ ] Recipe API and screens: list, edit form with ingredient suggest, recipe page with stepper . evidence: e2e/recipe.spec.ts
- [ ] Photo upload resized with sharp, stored on the photos volume, main photo plus gallery . evidence: test/photos.test.ts
- [ ] "I made this" logs a date and takes photos . evidence: e2e/recipe.spec.ts

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: on the real URL at phone size, add a recipe with a photo, step 4 to 6 . saves .peystack/shots/p3-recipe.png . passes when amounts scale and round up per the spec
- [ ] Regression lane: same scenario on trunk and head
- [ ] Perf: uploaded photo stored size trunk n/a head <= 400 kB
**Review gate.** Screenshots of the recipe page.

## PR P4: Browse

**Goal.** Swipe one dish at a time, filter by type and tag, add to a day of the week.
**Depends on.** P3
**Files.** src/web/, src/server/, e2e/

- [ ] Swipe crate modeled on LP-Collection src/web/BrowseScreen.tsx . evidence: e2e/browse.spec.ts
- [ ] Filters by main type and tags, plus list or grid view with search . evidence: e2e/browse.spec.ts
- [ ] "Add to week" picks a day . evidence: e2e/browse.spec.ts

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: on the real URL swipe, filter to Fish, add to Wednesday . saves .peystack/shots/p4-browse.png . passes when the dish is on Wednesday
- [ ] Regression lane: same scenario on trunk and head
- [ ] Perf: browse first paint trunk n/a head <= 1.5 s on the real URL
**Review gate.** Screenshots of Browse.

## PR P5: Week plan

**Goal.** Plan Monday to Sunday dinners and Runi Lee's meals with people counts and rule checks.
**Depends on.** P4
**Files.** src/server/, src/web/, drizzle/, test/, e2e/

- [ ] Schema: plan_days (date, people, dinner recipe), runi_days (recipe or same as dinner), rules (set, at least or at most, N, type or tag) with spec defaults . evidence: drizzle/
- [ ] Rules checker as a pure function with tests . evidence: test/rules.test.ts
- [ ] Week screen with week paging, people count per day, Runi Lee row, checklist . evidence: e2e/week.spec.ts

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: on the real URL plan a fish dinner and set Wednesday to 5 . saves .peystack/shots/p5-week.png . passes when the Fish rule ticks
- [ ] Regression lane: same scenario on trunk and head
- [ ] Perf: week API response trunk n/a head <= 200 ms
**Review gate.** Screenshots of Week.

## PR P6: Shopping list

**Goal.** A shared, live shopping list built from the chosen days.
**Depends on.** P5
**Files.** src/server/, src/web/, drizzle/, test/, e2e/

- [ ] Pure list builder: scale per day, add Runi +0.5, convert units, round to packs, leftovers, sections, hide always at home . evidence: test/shopping.test.ts
- [ ] Ticks and extra items stored per kitchen, polled every few seconds . evidence: e2e/shopping.spec.ts
- [ ] Pack size asked the first time it matters . evidence: e2e/shopping.spec.ts

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: two browser contexts as peyton and ronja on the real URL, one ticks an item . saves .peystack/shots/p6-list.png . passes when the other sees the tick within 5 s
- [ ] Regression lane: same scenario on trunk and head
- [ ] Perf: list build for 7 days trunk n/a head <= 200 ms
**Review gate.** Screenshots of the list.

## PR P7: Share links

**Goal.** A read-only public recipe link with photos and the stepper, which can be turned off.
**Depends on.** P3
**Files.** src/server/, src/web/, drizzle/, test/, e2e/

- [ ] Share tokens per recipe, on and off . evidence: test/share.test.ts
- [ ] Share button uses navigator.share, public page with stepper . evidence: e2e/share.spec.ts

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: open a share link logged out on the real URL, then turn it off . saves .peystack/shots/p7-share.png . passes when the page shows, then returns 404
- [ ] Regression lane: same scenario on trunk and head
- [ ] Perf: share page load trunk n/a head <= 1.5 s
**Review gate.** None.

## PR F1: Create week

**Goal.** Fill empty days by the rules, skip recent dishes, prefer leftover packs. Plain deterministic code.
**Depends on.** P6
**Files.** src/server/, src/web/, test/, e2e/

- [ ] Pure planner with tests for each rule . evidence: test/create-week.test.ts
- [ ] Button on the week screen . evidence: e2e/week.spec.ts

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: on the real URL press Create week on a half-empty week . saves .peystack/shots/f1.png . passes when only empty days fill and rules tick
- [ ] Regression lane: same scenario on trunk and head
- [ ] Perf: planner with 200 recipes trunk n/a head <= 100 ms
**Review gate.** None.

## PR F2: Reduce waste

**Goal.** Suggest one swap that uses up leftovers.
**Depends on.** F1
**Files.** src/server/, src/web/, test/, e2e/

- [ ] Pure suggester using the list builder's leftovers . evidence: test/reduce-waste.test.ts
- [ ] Button and gentle suggestion with accept . evidence: e2e/week.spec.ts

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: on the real URL a week with carrot leftovers gets a swap suggestion . saves .peystack/shots/f2.png . passes when accepting it lowers the leftover
- [ ] Regression lane: same scenario on trunk and head
- [ ] Perf: suggestion time trunk n/a head <= 200 ms
**Review gate.** None.

## PR F3: Photo to recipe

**Goal.** Turn a photo of a written recipe into a draft recipe for review.
**Depends on.** P3
**Files.** src/server/, src/web/, test/, e2e/, package.json

- [ ] Server call to the Anthropic API with a typed tool schema, fake in tests . evidence: test/photo-recipe.test.ts
- [ ] Review screen that saves into the normal edit form . evidence: e2e/photo-recipe.spec.ts

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: on the real URL upload a photo of a handwritten recipe . saves .peystack/shots/f3.png . passes when title, lines and steps are filled
- [ ] Regression lane: same scenario on trunk and head
- [ ] Perf: request time trunk n/a head <= 60 s
**Review gate.** None.

## PR F4: Freezer

**Goal.** Track freezer portions and plan nights from the freezer.
**Depends on.** P6
**Files.** src/server/, src/web/, drizzle/, test/, e2e/

- [ ] Schema and API for portions, log after a freezable cook . evidence: test/freezer.test.ts
- [ ] "From the freezer" plan slot decrements and adds nothing to the list . evidence: e2e/freezer.spec.ts

**Verification.** Tests alone are not verification. A PR is verified when its unit, live, and perf boxes are all checked.
- [ ] Unit: `npm run typecheck && npm test` passes
- [ ] Live: on the real URL log 6 portions, plan one night from the freezer . saves .peystack/shots/f4.png . passes when 5 remain and the list is unchanged
- [ ] Regression lane: same scenario on trunk and head
- [ ] Perf: week API response trunk n head <= n + 50 ms
**Review gate.** None.

## Appendix A: Prototypes

None needed. The stack and deploy path are copies of two working repos.

## Appendix B: Decisions

- Live updates by polling every 3 s. Simpler than SSE behind Traefik, and two users do not need more.
- Pure functions for units, rules, shopping list, create week and reduce waste. The server calls them, tests hit them directly.
- Amounts stored in the unit the recipe author typed. Conversion happens only when the list adds things up.
- Photos resized to 1600 px JPEG with sharp, served from the volume with long cache headers.

## Appendix C: Risks

- Small cluster. Postgres and the app keep memory requests at 128 Mi each.
- First deploy needs the ghcr package to be public or a pull secret. Make the package public after the first push.
- Cluster secrets cannot be read, so login checks use ~/food-planner-logins.txt on k3s-1 through the verifier only.
