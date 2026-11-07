#!/usr/bin/env bash
# Run once on k3s-1. Makes the food-planner secrets, seals them into k3s-gitops,
# registers the Argo CD app, and saves the two logins to ~/food-planner-logins.txt.
set -euo pipefail
export KUBECONFIG=$HOME/.kube/config
export PATH=$HOME/.local/bin:$PATH
cd ~/cluster
git pull -q

if [ -f secrets/food-planner-secrets.yaml ]; then
  echo "Already done. Logins are in ~/food-planner-logins.txt"
  exit 0
fi

rand() { openssl rand -hex 16; }
word() { shuf -n1 -e apple basil carrot dill fennel ginger leek mango olive pepper radish tomato; }
PEYTON_PASSWORD="$(word)-$(word)-$(openssl rand -hex 2)"
RONJA_PASSWORD="$(word)-$(word)-$(openssl rand -hex 2)"
ANTHROPIC_API_KEY="$(kubectl -n lp-collection get secret lp-collection-anthropic -o jsonpath='{.data.ANTHROPIC_API_KEY}' | base64 -d)"

kubectl create secret generic food-planner-secrets -n food-planner --dry-run=client -o yaml \
  --from-literal=POSTGRES_PASSWORD="$(rand)" \
  --from-literal=SESSION_SECRET="$(rand)$(rand)" \
  --from-literal=PEYTON_PASSWORD="$PEYTON_PASSWORD" \
  --from-literal=RONJA_PASSWORD="$RONJA_PASSWORD" \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  | kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system -o yaml \
  > secrets/food-planner-secrets.yaml

cat > apps/food-planner.yaml <<'EOF'
# Manifests live in the app repo (deploy/); its CI bumps the image tags there.
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: food-planner
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/PeyHunter/food-planner.git
    targetRevision: main
    path: deploy
  destination:
    server: https://kubernetes.default.svc
    namespace: food-planner
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
EOF

kubectl create namespace food-planner --dry-run=client -o yaml | kubectl apply -f - >/dev/null
git add apps/food-planner.yaml secrets/food-planner-secrets.yaml
git commit -qm "food-planner: Argo app and sealed secrets"
git push -q

umask 077
printf 'food-planner.peytonhunter.com\n\npeyton  %s\nronja   %s\n' "$PEYTON_PASSWORD" "$RONJA_PASSWORD" > ~/food-planner-logins.txt
echo "Done. Logins saved in ~/food-planner-logins.txt on k3s-1."
