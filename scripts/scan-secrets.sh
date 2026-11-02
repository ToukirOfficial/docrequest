#!/usr/bin/env bash
# Checks files for secrets and server details before they reach this PUBLIC repo.
#   scripts/scan-secrets.sh            staged files (run before every commit)
#   scripts/scan-secrets.sh --all      every tracked file
#   scripts/scan-secrets.sh --history  the whole git history
# Server values come from deploy.env and the SSH config at run time, so this script holds none.
set -uo pipefail
cd "$(dirname "$0")/.."
MODE=${1:-staged}

# Values that must never be committed.
declare -a LITERAL=()
if [ -f deploy.env ]; then
  while IFS='=' read -r k v; do
    # SSH_HOST is a local alias name (here the public project name), not a server detail.
    case "$k" in ''|\#*|SSH_HOST|SITE_URL|MAX_UPLOAD_MB|PM2_PREFIX|*_MAX_MEMORY) continue ;; esac
    [ -n "$v" ] && LITERAL+=("$v")
  done < deploy.env
fi
for alias in vps $(awk -F= '/^SSH_HOST=/{print $2}' deploy.env 2>/dev/null); do
  hn=$(ssh -G "$alias" 2>/dev/null | awk '/^hostname /{print $2}')
  [ -n "$hn" ] && [ "$hn" != "$alias" ] && LITERAL+=("$hn")
done
# Patterns: private keys, cloud keys, real-looking secrets, any IPv4 other than loopback/any.
PATTERNS=(
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'AKIA[0-9A-Z]{16}'
  'ghp_[A-Za-z0-9]{36}'
  'sk_live_[A-Za-z0-9]{20,}'
  '(JWT_SECRET|CODE_PEPPER|MASTER_KEY|POSTGRES_PASSWORD|SMTP_URL|DATABASE_URL)=[^$<{ '"'"'"][^ ]{15,}'
  '(^|[^0-9.])((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])([^0-9.]|$)'
)
# Known placeholders and templates: local dev defaults, examples, ${variables}.
PLACEHOLDER='=change-me|@localhost|smtp://localhost|example\.com|\$DB_PASS|\$\{'
IP_OK='(^|[^0-9.])(127\.0\.0\.1|0\.0\.0\.0)([^0-9.]|$)'

case "$MODE" in
  --all) CONTENT() { git grep -I -n -E -e "$1" -- . ':!pnpm-lock.yaml' 2>/dev/null; }; FIXED() { git grep -I -n -w -F -- "$1" -- . ':!pnpm-lock.yaml' 2>/dev/null; } ;;
  --history) CONTENT() { git log -p --all --format='commit %h' -- . ':!pnpm-lock.yaml' 2>/dev/null | grep -E '^\+' | grep -E -e "$1"; }; FIXED() { git log -p --all --format='commit %h' -- . ':!pnpm-lock.yaml' 2>/dev/null | grep -E '^\+' | grep -w -F -- "$1"; } ;;
  *) CONTENT() { git diff --cached -U0 -- . ':!pnpm-lock.yaml' | grep -E '^\+' | grep -nE -e "$1"; }; FIXED() { git diff --cached -U0 -- . ':!pnpm-lock.yaml' | grep -E '^\+' | grep -nwF -- "$1"; } ;;
esac

found=0
for v in "${LITERAL[@]}"; do
  if out=$(FIXED "$v") && [ -n "$out" ]; then echo "SERVER VALUE found (value hidden):"; echo "$out" | sed "s|$v|<hidden>|g" | head -5; found=1; fi
done
for p in "${PATTERNS[@]}"; do
  out=$(CONTENT "$p" | grep -vE "$IP_OK" || true)
  [ "$p" = "${PATTERNS[4]}" ] && out=$(echo "$out" | grep -vE "$PLACEHOLDER" || true)
  # SVG path data (d="M…") is full of number runs like 2.2.82.64.
  [ "$p" = "${PATTERNS[5]}" ] && out=$(echo "$out" | grep -vE ' d="M' || true)
  if [ -n "$out" ]; then echo "PATTERN /$p/:"; echo "$out" | head -5; found=1; fi
done

if [ $found -eq 0 ]; then echo "Secret and IP scan ($MODE): clean"; else echo "Secret and IP scan ($MODE): FOUND ISSUES"; exit 1; fi
