# Plan: breakfast and lunch

Status: proposed. Not built yet. Dinner stays the only meal until someone turns the others on.

## Goal

Let a kitchen plan breakfast and lunch on any day, without changing how dinner works today. Each kitchen decides per meal whether it wants it. A kitchen that never turns them on sees exactly what it sees now.

## Data

Today a plan row is one day: `plan_days(kitchen_id, date, people, dinner_recipe_id, from_freezer)`. The column name already says dinner, so the cheapest clean step is a `meal` column and a wider key.

```sql
-- new table, copied from plan_days
plan_meals(
  kitchen_id uuid not null references kitchens(id) on delete cascade,
  date date not null,
  meal text not null,              -- 'dinner' | 'lunch' | 'breakfast'
  people int not null default 2,
  recipe_id uuid references recipes(id) on delete set null,  -- was dinner_recipe_id
  from_freezer boolean not null default false,
  primary key (kitchen_id, date, meal)
)
```

A kitchen setting says which meals it plans:

```sql
alter table kitchens add column meals text[] not null default '{dinner}';
```

Child meals get the same shape: `child_meals(child_id, date, meal, kind, recipe_id, from_freezer)`.

Migration, in one transaction:
1. Create `plan_meals` and `child_meals`.
2. Copy every `plan_days` row as `meal = 'dinner'`; copy every `child_days` row the same way.
3. Keep `plan_days` and `child_days` as views over `meal = 'dinner'` for one release, so old code and old phones keep working.
4. Drop the views and the old tables in the next release.

Every existing row becomes a dinner row, so no plan is lost and no shopping list changes.

## API

Keep the current dinner routes and add a meal to the path:

- `PUT /api/plan/days/:date/meals/:meal` with `{ recipeId, fromFreezer, people }`.
- `PUT /api/plan/days/:date/meals/:meal/children/:childId`.
- `GET /api/plan/weeks/:monday` returns `meals: { dinner, lunch?, breakfast? }` per day. The old `dinner` field stays for one release.

Validation is the same as today. A meal that the kitchen has not turned on returns 400 with a plain message.

## Shopping

The list builder already takes a set of planned dinners with people counts. Change it to take `(recipe, people, meal)` rows and sum them all. Same ingredient names still merge; pack rounding and leftovers do not change.

`Same as dinner, mashed` keeps its +0.5 portion rule, but only for dinner. Breakfast and lunch child meals add nothing unless a kitchen asks for it later.

## Rules

A rule gets an optional `meal` scope, default `dinner`, so the existing rules keep counting dinners only. The rules card groups by meal when more than one meal is on. `Create week` fills dinner first; a second button fills lunch and breakfast once the kitchen turns them on.

## UI

- Week screen: each day card gets a quiet `+ Lunch` / `+ Breakfast` row under dinner when the kitchen has them on. Meals are collapsed by default.
- A small "Meals" setting (in the name menu or Week settings) toggles breakfast and lunch per kitchen.
- The day picker is unchanged; it already picks a recipe. It just writes the chosen meal.
- The recipe page's "Add to week" asks which meal when more than one is on.

## Phases

1. Schema + copy + API with dinner only. No visible change. Tests prove the copied rows and the old routes still match.
2. Kitchen setting and the week UI for lunch and breakfast.
3. Shopping sums every meal; rules can scope to a meal.
4. Create week can fill lunch and breakfast.

Each phase ships on its own. If phase 2 is not wanted, phase 1 can sit unused.

## Risks

- Two meals using the same recipe on one day double the shopping amounts. That is correct, but the list should show which day each line came from.
- The small cluster stores one row per meal per day per kitchen. At three meals, seven days and a handful of kitchens this is still tiny.
- Old phones that keep the old bundle for a week will read the dinner views. Keep the views for at least one release.
