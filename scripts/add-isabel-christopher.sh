#!/usr/bin/env bash
# Run once on k3s-1. Adds Isabel's and Christopher's passwords to the sealed food-planner secret,
# restarts the app so it makes their kitchen, and adds the logins to ~/food-planner-logins.txt.
set -euo pipefail
export KUBECONFIG=$HOME/.kube/config
export PATH=$HOME/.local/bin:$PATH
cd ~/cluster
git pull -q

if grep -q ISABEL_PASSWORD secrets/food-planner-secrets.yaml; then
  echo "Already done. Logins are in ~/food-planner-logins.txt"
  exit 0
fi

word() { shuf -n1 -e apple basil carrot dill fennel ginger leek mango olive pepper radish tomato; }
ISABEL_PASSWORD="$(word)-$(word)-$(openssl rand -hex 2)"
CHRISTOPHER_PASSWORD="$(word)-$(word)-$(openssl rand -hex 2)"

kubectl create secret generic food-planner-secrets -n food-planner --dry-run=client -o json \
  --from-literal=ISABEL_PASSWORD="$ISABEL_PASSWORD" \
  --from-literal=CHRISTOPHER_PASSWORD="$CHRISTOPHER_PASSWORD" \
  | kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system \
    --merge-into secrets/food-planner-secrets.yaml

git add secrets/food-planner-secrets.yaml
git commit -qm "food-planner: logins for isabel and christopher"
git push -q

echo "Waiting for the cluster to pick up the new secret..."
for _ in $(seq 60); do
  kubectl -n food-planner get secret food-planner-secrets -o jsonpath='{.data.ISABEL_PASSWORD}' | grep -q . && break
  sleep 5
done
kubectl -n food-planner rollout restart deploy/web >/dev/null
kubectl -n food-planner rollout status deploy/web --timeout=180s >/dev/null

umask 077
printf '\nisabel       %s\nchristopher  %s\n' "$ISABEL_PASSWORD" "$CHRISTOPHER_PASSWORD" >> ~/food-planner-logins.txt
echo "Done. Isabel's and Christopher's logins are in ~/food-planner-logins.txt on k3s-1."
