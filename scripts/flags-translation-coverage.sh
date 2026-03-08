#!/usr/bin/env bash
set -euo pipefail

FLAGS_FILE="${1:-i18n/flags/es.json}"
SOURCE_FILE="${2:-flaginfo.json}"

usage() {
  cat <<'EOF'
Usage:
  scripts/flags-translation-coverage.sh [flags_file] [source_file]

Defaults:
  flags_file  = i18n/flags/es.json
  source_file = flaginfo.json
EOF
}

require_tool() {
  local tool_name="$1"
  if ! command -v "$tool_name" >/dev/null 2>&1; then
    echo "Missing required tool: $tool_name" >&2
    exit 1
  fi
}

if [[ "${FLAGS_FILE}" == "-h" || "${FLAGS_FILE}" == "--help" ]]; then
  usage
  exit 0
fi

require_tool jq

if [[ ! -f "$FLAGS_FILE" ]]; then
  echo "Flags file not found: $FLAGS_FILE" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Source file not found: $SOURCE_FILE" >&2
  exit 1
fi

jq empty "$FLAGS_FILE" >/dev/null
jq empty "$SOURCE_FILE" >/dev/null

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

source_codes="$tmp_dir/source_codes.txt"
jq -r '.[].shortname' "$SOURCE_FILE" | sort -u > "$source_codes"
total_flags="$(wc -l < "$source_codes" | tr -d ' ')"

count_nonempty_for_field() {
  local field="$1"
  jq -r --arg field "$field" '
    to_entries[]
    | select(.key | test("^[a-z0-9]{2}_" + $field + "$"))
    | select((.value | type) == "string")
    | select((.value | gsub("<br\\s*/?>";"") | gsub("&nbsp;";"") | gsub("\\s";"")) != "")
    | .key
    | split("_")[0]
  ' "$FLAGS_FILE" | sort -u
}

print_field_coverage() {
  local field="$1"
  local translated_file="$tmp_dir/${field}_translated.txt"
  local missing_file="$tmp_dir/${field}_missing.txt"
  local translated_count
  local percent

  count_nonempty_for_field "$field" > "$translated_file"
  comm -23 "$source_codes" "$translated_file" > "$missing_file"

  translated_count="$(wc -l < "$translated_file" | tr -d ' ')"
  percent="$(awk -v a="$translated_count" -v b="$total_flags" 'BEGIN { if (b==0) print "0.00"; else printf "%.2f", (a*100)/b }')"

  echo "- ${field}: ${translated_count}/${total_flags} (${percent}%)"

  if [[ "$translated_count" -lt "$total_flags" ]]; then
    echo "  missing example: $(head -n 8 "$missing_file" | paste -sd ',' - | sed 's/,/, /g')"
  fi
}

echo "Coverage report for $FLAGS_FILE"
echo "Source flags: $total_flags"
print_field_coverage "name"
print_field_coverage "symbolism"
print_field_coverage "funfacts"
