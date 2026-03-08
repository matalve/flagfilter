#!/usr/bin/env bash
set -euo pipefail

API_BASE="https://api.poeditor.com/v2"
DEFAULT_LANGUAGE="es"
DEFAULT_FLAGS_FILE="i18n/flags/es.json"

usage() {
  cat <<'EOF'
Usage:
  scripts/poeditor-flags-sync.sh pull [language] [output_file]
  scripts/poeditor-flags-sync.sh push [language] [input_file]

Required environment variables:
  POEDITOR_API_TOKEN
  POEDITOR_PROJECT_ID

Examples:
  POEDITOR_API_TOKEN=... POEDITOR_PROJECT_ID=654073 scripts/poeditor-flags-sync.sh pull es i18n/flags/es.json
  POEDITOR_API_TOKEN=... POEDITOR_PROJECT_ID=654073 scripts/poeditor-flags-sync.sh push es i18n/flags/es.json
EOF
}

require_env() {
  local var_name="$1"
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
}

require_tool() {
  local tool_name="$1"
  if ! command -v "$tool_name" >/dev/null 2>&1; then
    echo "Missing required tool: $tool_name" >&2
    exit 1
  fi
}

parse_status() {
  local response="$1"
  echo "$response" | jq -r '.response.status // "unknown"'
}

pull_translations() {
  local language="$1"
  local out_file="$2"
  local tmp_file
  local response
  local export_url

  tmp_file="$(mktemp)"
  response="$(curl -sS -X POST "${API_BASE}/projects/export" \
    -d "api_token=${POEDITOR_API_TOKEN}" \
    -d "id=${POEDITOR_PROJECT_ID}" \
    -d "language=${language}" \
    -d "type=key_value_json")"

  if [[ "$(parse_status "$response")" != "success" ]]; then
    echo "POEditor export failed:" >&2
    echo "$response" | jq . >&2 || echo "$response" >&2
    rm -f "$tmp_file"
    exit 1
  fi

  export_url="$(echo "$response" | jq -r '.result.url // empty')"
  if [[ -z "$export_url" ]]; then
    echo "POEditor export did not return a download URL." >&2
    rm -f "$tmp_file"
    exit 1
  fi

  curl -fsSL "$export_url" -o "$tmp_file"
  jq empty "$tmp_file" >/dev/null
  mkdir -p "$(dirname "$out_file")"
  mv "$tmp_file" "$out_file"

  echo "Downloaded ${language} flags translations to: ${out_file}"
}

push_translations() {
  local language="$1"
  local in_file="$2"
  local response

  if [[ ! -f "$in_file" ]]; then
    echo "Input file not found: $in_file" >&2
    exit 1
  fi

  jq empty "$in_file" >/dev/null

  response="$(curl -sS -X POST "${API_BASE}/projects/upload" \
    -F "api_token=${POEDITOR_API_TOKEN}" \
    -F "id=${POEDITOR_PROJECT_ID}" \
    -F "language=${language}" \
    -F "updating=translations" \
    -F "overwrite=1" \
    -F "file=@${in_file}")"

  if [[ "$(parse_status "$response")" != "success" ]]; then
    echo "POEditor upload failed:" >&2
    echo "$response" | jq . >&2 || echo "$response" >&2
    exit 1
  fi

  echo "Uploaded ${language} flags translations from: ${in_file}"
}

main() {
  local action="${1:-}"
  local language="${2:-$DEFAULT_LANGUAGE}"
  local file_path="${3:-$DEFAULT_FLAGS_FILE}"

  if [[ -z "$action" || "$action" == "-h" || "$action" == "--help" ]]; then
    usage
    exit 0
  fi

  require_tool curl
  require_tool jq
  require_env POEDITOR_API_TOKEN
  require_env POEDITOR_PROJECT_ID

  case "$action" in
    pull)
      pull_translations "$language" "$file_path"
      ;;
    push)
      push_translations "$language" "$file_path"
      ;;
    *)
      echo "Unknown action: $action" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
