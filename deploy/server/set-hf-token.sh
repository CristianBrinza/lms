#!/usr/bin/env bash
# Stores the Hugging Face read token for the closet's virtual try-on in deploy/.env (chmod 600).
# The token is typed, never echoed or logged.
set -euo pipefail
env_file="$(cd "$(dirname "$0")/.." && pwd)/.env"
read -rsp 'Hugging Face token (hf_…): ' token
echo
[[ $token == hf_* ]] || { echo 'That does not look like a Hugging Face token (it starts with hf_).'; exit 1; }
touch "$env_file" && chmod 600 "$env_file"
grep -v '^HF_TOKEN=' "$env_file" > "$env_file.tmp" || true
printf 'HF_TOKEN=%s\n' "$token" >> "$env_file.tmp"
mv "$env_file.tmp" "$env_file" && chmod 600 "$env_file"
echo 'Saved. The next release passes it to the api.'
