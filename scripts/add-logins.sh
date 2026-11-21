#!/usr/bin/env bash
# Run on k3s-1:  bash add-logins.sh valdemar anna
# Gives each named login a new password made of two food words (e.g. carrotmango), seals only those
# into the food-planner secret (all other passwords are kept), restarts the app so it makes the
# kitchen, sets the passwords, and adds the logins to ~/food-planner-logins.txt.
# The logins must already be in kitchenConfigs (src/server/kitchens-config.ts) in the running app.
# Safe to run again: each run gives the named logins new passwords.
set -euo pipefail
if [ $# -eq 0 ]; then
  echo "Usage: bash add-logins.sh <login> [<login>...]   e.g. bash add-logins.sh valdemar anna"
  exit 1
fi
for name in "$@"; do
  if ! [[ "$name" =~ ^[a-z]+$ ]]; then echo "Logins are lower-case letters only (got \"$name\")."; exit 1; fi
done
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

names=("$@")
declare -A passwords
args=()
for name in "${names[@]}"; do
  passwords[$name]="$(easy_password)"
  args+=(--from-literal="${name^^}_PASSWORD=${passwords[$name]}")
done

# --merge-into adds or replaces only these keys; the rest of the sealed secret stays as it is.
kubectl create secret generic food-planner-secrets -n food-planner --dry-run=client -o json "${args[@]}" \
  | kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system -o yaml \
    --merge-into secrets/food-planner-secrets.yaml

git add secrets/food-planner-secrets.yaml
git commit -qm "food-planner: logins for ${names[*]}"
git push -q

umask 077
{
  echo
  for name in "${names[@]}"; do printf '%-12s %s\n' "$name" "${passwords[$name]}"; done
} >> ~/food-planner-logins.txt

echo "Waiting for the cluster to pick up the new passwords (up to 5 minutes)..."
last="${names[-1]}"
want="$(printf '%s' "${passwords[$last]}" | base64)"
ready=no
for _ in $(seq 60); do
  if [ "$(kubectl -n food-planner get secret food-planner-secrets -o jsonpath="{.data.${last^^}_PASSWORD}")" = "$want" ]; then ready=yes; break; fi
  sleep 5
done
if [ "$ready" = no ]; then
  echo "The cluster didn't pick up the new passwords in 5 minutes. Wait a bit and run this script again."
  exit 1
fi
kubectl -n food-planner rollout restart deploy/web >/dev/null
kubectl -n food-planner rollout status deploy/web --timeout=180s >/dev/null

# The app only uses these the first time it makes a login, so set them directly too.
for name in "${names[@]}"; do
  if ! kubectl -n food-planner exec deploy/web -- env NEW_PASSWORD="${passwords[$name]}" node src/server/set-password.ts "$name"; then
    echo "The app has no login called $name. Is it in kitchenConfigs in the version that is running? The password is saved; run this again after the update is live."
    exit 1
  fi
done

echo
echo "Done. New logins (also saved in ~/food-planner-logins.txt):"
for name in "${names[@]}"; do printf '  %-12s %s\n' "$name" "${passwords[$name]}"; done
