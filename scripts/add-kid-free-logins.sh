#!/usr/bin/env bash
# Run on k3s-1. Gives isabel, christopher, magnus and mads new passwords made of two food words
# (e.g. carrotmango), seals them into the food-planner secret, restarts the app so it makes the
# kitchens, sets the passwords, and adds the logins to ~/food-planner-logins.txt.
# Safe to run again: each run gives all four new passwords.
set -euo pipefail
export KUBECONFIG=$HOME/.kube/config
export PATH=$HOME/.local/bin:$PATH
cd ~/cluster
git pull -q

foods=(apple banana basil bean carrot cherry corn dill fennel garlic ginger grape kale leek lemon lime mango melon olive onion pea peach pear pepper plum potato radish rice tomato)
easy_password() {
  local first second
  first="${foods[RANDOM % ${#foods[@]}]}"
  second="$first"
  while [ "$second" = "$first" ]; do second="${foods[RANDOM % ${#foods[@]}]}"; done
  echo "$first$second"
}

names=(isabel christopher magnus mads)
declare -A passwords
args=()
for name in "${names[@]}"; do
  passwords[$name]="$(easy_password)"
  args+=(--from-literal="${name^^}_PASSWORD=${passwords[$name]}")
done

kubectl create secret generic food-planner-secrets -n food-planner --dry-run=client -o json "${args[@]}" \
  | kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system -o yaml \
    --merge-into secrets/food-planner-secrets.yaml

git add secrets/food-planner-secrets.yaml
git commit -qm "food-planner: logins for kitchens without kids"
git push -q

echo "Waiting for the cluster to pick up the new passwords (up to 5 minutes)..."
want="$(printf '%s' "${passwords[mads]}" | base64)"
for _ in $(seq 60); do
  [ "$(kubectl -n food-planner get secret food-planner-secrets -o jsonpath='{.data.MADS_PASSWORD}')" = "$want" ] && break
  sleep 5
done
kubectl -n food-planner rollout restart deploy/web >/dev/null
kubectl -n food-planner rollout status deploy/web --timeout=180s >/dev/null

# The app only uses these the first time it makes a login, so set them directly too.
for name in "${names[@]}"; do
  kubectl -n food-planner exec deploy/web -- env NEW_PASSWORD="${passwords[$name]}" node src/server/set-password.ts "$name"
done

umask 077
{
  echo
  for name in "${names[@]}"; do printf '%-12s %s\n' "$name" "${passwords[$name]}"; done
} >> ~/food-planner-logins.txt
echo
echo "Done. New logins (also saved in ~/food-planner-logins.txt):"
for name in "${names[@]}"; do printf '  %-12s %s\n' "$name" "${passwords[$name]}"; done
