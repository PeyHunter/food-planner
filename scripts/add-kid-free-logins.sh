#!/usr/bin/env bash
# Run on k3s-1:  bash add-kid-free-logins.sh [login...]
# Gives each named login a new password, seals it into the food-planner secret, restarts the app,
# and sets the password. With no names it does all eight kid-free logins. The work is in add-logins.sh.
set -euo pipefail
if [ $# -eq 0 ]; then
  set -- isabel christopher magnus mads annad mathias annaa jacob
fi
exec bash "$(dirname "$0")/add-logins.sh" "$@"
