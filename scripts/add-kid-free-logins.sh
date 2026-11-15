#!/usr/bin/env bash
# Run on k3s-1. Adds passwords for the kitchens without kids (isabel + christopher, magnus + mads)
# to the sealed food-planner secret, restarts the app so it makes the kitchens,
# and adds the logins to ~/food-planner-logins.txt. Pairs that already have passwords are skipped.
set -euo pipefail
export KUBECONFIG=$HOME/.kube/config
export PATH=$HOME/.local/bin:$PATH
cd ~/cluster
git pull -q

word() { shuf -n1 -e apple basil carrot dill fennel ginger leek mango olive pepper radish tomato; }
args=()
logins=""
added=()
for name in isabel christopher magnus mads; do
  key="${name^^}_PASSWORD"
  grep -q "$key" secrets/food-planner-secrets.yaml && continue
  password="$(word)-$(word)-$(openssl rand -hex 2)"
  args+=(--from-literal="$key=$password")
  logins+="$(printf '%-12s %s' "$name" "$password")"$'\n'
  added+=("$key")
done

if [ ${#args[@]} -eq 0 ]; then
  echo "Already done. Logins are in ~/food-planner-logins.txt"
  exit 0
fi

kubectl create secret generic food-planner-secrets -n food-planner --dry-run=client -o json "${args[@]}" \
  | kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system -o yaml \
    --merge-into secrets/food-planner-secrets.yaml

git add secrets/food-planner-secrets.yaml
git commit -qm "food-planner: logins for kitchens without kids"
git push -q

echo "Waiting for the cluster to pick up the new secret..."
last="${added[-1]}"
for _ in $(seq 60); do
  kubectl -n food-planner get secret food-planner-secrets -o jsonpath="{.data.$last}" | grep -q . && break
  sleep 5
done
kubectl -n food-planner rollout restart deploy/web >/dev/null
kubectl -n food-planner rollout status deploy/web --timeout=180s >/dev/null

umask 077
printf '\n%s' "$logins" >> ~/food-planner-logins.txt
echo "Done. The new logins are in ~/food-planner-logins.txt on k3s-1."
