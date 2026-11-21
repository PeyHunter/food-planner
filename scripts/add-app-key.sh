#!/usr/bin/env bash
# Run on k3s-1:  bash add-app-key.sh
# Makes APP_SECRET_KEY (32 random bytes, base64), the key that seals each person's nemlig.com login, seals only
# that key into the food-planner secret (all other keys are kept), and restarts the app so it picks it up.
# Run it once. Running it again makes a new key, and logins sealed with the old key can no longer be opened
# (people then connect nemlig.com again), so the script stops if the key is already there.
set -euo pipefail
export KUBECONFIG=$HOME/.kube/config
export PATH=$HOME/.local/bin:$PATH
cd ~/cluster
git pull -q

if kubectl -n food-planner get secret food-planner-secrets -o jsonpath='{.data.APP_SECRET_KEY}' | grep -q .; then
  echo "APP_SECRET_KEY is already set. Nothing to do."
  exit 0
fi

key="$(head -c 32 /dev/urandom | base64 -w0)"
# --merge-into adds or replaces only this key; the rest of the sealed secret stays as it is.
kubectl create secret generic food-planner-secrets -n food-planner --dry-run=client -o json --from-literal=APP_SECRET_KEY="$key" \
  | kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system -o yaml \
    --merge-into secrets/food-planner-secrets.yaml
unset key

git add secrets/food-planner-secrets.yaml
git commit -qm "food-planner: APP_SECRET_KEY"
git push -q

echo "Waiting for the cluster to pick up the key (up to 5 minutes)..."
for _ in $(seq 60); do
  if kubectl -n food-planner get secret food-planner-secrets -o jsonpath='{.data.APP_SECRET_KEY}' | grep -q .; then
    kubectl -n food-planner rollout restart deploy/web >/dev/null
    kubectl -n food-planner rollout status deploy/web --timeout=180s >/dev/null
    echo "Done. The app has its secret key."
    exit 0
  fi
  sleep 5
done
echo "The cluster didn't pick up the key in 5 minutes. Wait a bit, then run: kubectl -n food-planner rollout restart deploy/web"
exit 1
