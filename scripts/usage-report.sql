-- Claude API calls and dollars per kitchen and login, last 30 days.
-- On k3s-1: kubectl -n food-planner exec -i postgres-0 -- psql -U food_planner food_planner < scripts/usage-report.sql
select
  k.name as kitchen,
  coalesce(u.username, '(deleted)') as login,
  count(*) as calls,
  string_agg(distinct a.feature, ', ') as features,
  sum(a.input_tokens) as input_tokens,
  sum(a.output_tokens) as output_tokens,
  round(sum(a.cost_usd), 2) as dollars
from ai_calls a
join kitchens k on k.id = a.kitchen_id
left join users u on u.id = a.user_id
where a.created_at > now() - interval '30 days'
group by grouping sets ((k.name, u.username), ())
order by k.name nulls last, dollars desc;
