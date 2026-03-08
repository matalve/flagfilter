#!/usr/bin/env bash
set -euo pipefail

FLAGS_FILE="${1:-i18n/flags/es.json}"
SOURCE_FILE="${2:-flaginfo.json}"
STRICT_EMPTY="${STRICT_EMPTY:-0}"

if [[ "${FLAGS_FILE}" == "--strict-empty" ]]; then
  STRICT_EMPTY=1
  FLAGS_FILE="${2:-i18n/flags/es.json}"
  SOURCE_FILE="${3:-flaginfo.json}"
fi

usage() {
  cat <<'EOF'
Usage:
  scripts/validate-flags-i18n.sh [--strict-empty] [flags_file] [source_file]

Defaults:
  flags_file  = i18n/flags/es.json
  source_file = flaginfo.json

Behavior:
  - Validates key format: shortname_(name|symbolism|funfacts)
  - Validates shortname exists in source file
  - Detects empty translation values
  - Empty values are warnings by default, errors with --strict-empty
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

invalid_keys_file="$tmp_dir/invalid_keys.txt"
unknown_codes_file="$tmp_dir/unknown_codes.txt"
empty_values_file="$tmp_dir/empty_values.txt"
all_codes_file="$tmp_dir/all_codes.txt"
source_codes_file="$tmp_dir/source_codes.txt"

jq -r 'to_entries[] | select(.key | test("^[a-z0-9-]+_(name|symbolism|funfacts)$") | not) | .key' "$FLAGS_FILE" > "$invalid_keys_file"

jq -r 'keys[] | select(test("^[a-z0-9-]+_(name|symbolism|funfacts)$")) | sub("_(name|symbolism|funfacts)$"; "")' "$FLAGS_FILE" \
  | sort -u > "$all_codes_file"
jq -r '.[].shortname' "$SOURCE_FILE" | sort -u > "$source_codes_file"
comm -23 "$all_codes_file" "$source_codes_file" > "$unknown_codes_file"

jq -r '
  to_entries[]
  | select(.key | test("^[a-z0-9-]+_(name|symbolism|funfacts)$"))
  | select(
      (.value | type) != "string"
      or
      ((.value | gsub("<br\\s*/?>";"") | gsub("&nbsp;";"") | gsub("\\s";"")) == "")
    )
  | .key
' "$FLAGS_FILE" > "$empty_values_file"

invalid_count="$(wc -l < "$invalid_keys_file" | tr -d ' ')"
unknown_count="$(wc -l < "$unknown_codes_file" | tr -d ' ')"
empty_count="$(wc -l < "$empty_values_file" | tr -d ' ')"

echo "Validation summary for $FLAGS_FILE"
echo "- invalid keys: $invalid_count"
echo "- unknown shortnames: $unknown_count"
echo "- empty values: $empty_count"

if [[ "$invalid_count" -gt 0 ]]; then
  echo
  echo "Invalid keys:"
  sed 's/^/  - /' "$invalid_keys_file"
fi

if [[ "$unknown_count" -gt 0 ]]; then
  echo
  echo "Unknown shortnames:"
  sed 's/^/  - /' "$unknown_codes_file"
fi

if [[ "$empty_count" -gt 0 ]]; then
  echo
  if [[ "$STRICT_EMPTY" -eq 1 ]]; then
    echo "Empty values (strict mode):"
  else
    echo "Empty values (warning):"
  fi
  sed -n '1,30p' "$empty_values_file" | sed 's/^/  - /'
  if [[ "$empty_count" -gt 30 ]]; then
    echo "  ... and $((empty_count - 30)) more"
  fi
fi

if [[ "$invalid_count" -gt 0 || "$unknown_count" -gt 0 ]]; then
  exit 1
fi

if [[ "$STRICT_EMPTY" -eq 1 && "$empty_count" -gt 0 ]]; then
  exit 1
fi
