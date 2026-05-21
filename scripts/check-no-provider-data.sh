#!/usr/bin/env bash
#
# check-no-provider-data.sh
# -------------------------
# Pre-push guardrail for gtfs-sqlite-toolkit (Memo 051 Phase 6 / PRD-30).
#
# Purpose:
#   Prevents accidental commit of third-party GTFS provider data (VBB, BVG,
#   DVB, MVG, KVB, Deutsche Bahn, etc.) into this public repo. Such data is
#   licensed (CC-BY or proprietary) and MUST NOT be redistributed via this
#   repository (see Memo 051 REV-04 Kap. 9.4).
#
# Usage:
#   bash scripts/check-no-provider-data.sh
#
# Exit codes:
#   0 = clean (no suspicious files found)
#   1 = suspicious files detected (commit/push should be aborted)
#
# Scan sources:
#   - git diff --cached --name-only   (staged files)
#   - git status --porcelain          (untracked + modified files)
#
# Detection heuristics (any match flags the file):
#   1. Path indicators: file path contains a known provider slug
#      (gtfs-de, vbb, bvg, dvb, mvg, kvb).
#   2. Content indicators: file is a GTFS CSV (agency.txt, routes.txt, ...)
#      and contains a real-world transit-agency name (VBB, BVG, ...).
#   3. Binary signature: file has a .db extension outside the synthetic
#      fixture directory (tests/fixtures/synthetic-gtfs/).
#
# Whitelist (NEVER flagged):
#   - tests/fixtures/synthetic-gtfs/source/*.txt   (CC0 synthetic CSVs)
#   - tests/fixtures/synthetic-gtfs/README.md
#   - tests/fixtures/synthetic-gtfs/LICENSE
#   - tests/fixtures/synthetic-gtfs/build-fixture.mjs
#   - tests/manual/run-*.mjs                       (test runners — script
#                                                   code only, no payload)
#   - scripts/check-no-provider-data.sh            (this script itself)
#
# How to extend:
#   - Add a new provider slug: append to PROVIDER_PATH_SLUGS array below.
#   - Add a new agency name : append to PROVIDER_AGENCY_NAMES array below.
#   - Whitelist a known-safe path : append to WHITELIST_PATHS or
#     WHITELIST_GLOBS array below (globs use bash pattern matching).
#

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

PROVIDER_PATH_SLUGS=(
    "gtfs-de"
    "vbb"
    "bvg"
    "dvb"
    "mvg"
    "kvb"
)

PROVIDER_AGENCY_NAMES=(
    "VBB"
    "BVG"
    "DVB"
    "MVG"
    "KVB"
    "Deutsche Bahn"
    "Berliner Verkehrsbetriebe"
    "Verkehrsverbund Berlin-Brandenburg"
)

# Exact-match whitelist (path relative to repo root)
WHITELIST_PATHS=(
    "tests/fixtures/synthetic-gtfs/README.md"
    "tests/fixtures/synthetic-gtfs/LICENSE"
    "tests/fixtures/synthetic-gtfs/build-fixture.mjs"
    "scripts/check-no-provider-data.sh"
)

# Glob-match whitelist (bash pattern; expanded via [[ $path == $glob ]])
WHITELIST_GLOBS=(
    "tests/fixtures/synthetic-gtfs/source/*.txt"
    "tests/manual/run-*.mjs"
)

# GTFS CSV filenames that warrant content inspection
GTFS_CSV_FILES=(
    "agency.txt"
    "routes.txt"
    "stops.txt"
    "trips.txt"
    "stop_times.txt"
    "calendar.txt"
    "calendar_dates.txt"
    "shapes.txt"
    "fare_attributes.txt"
    "fare_rules.txt"
    "frequencies.txt"
    "transfers.txt"
    "feed_info.txt"
)

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

is_whitelisted() {
    local path="$1"
    local entry
    for entry in "${WHITELIST_PATHS[@]}"; do
        if [[ "$path" == "$entry" ]]; then
            return 0
        fi
    done
    for entry in "${WHITELIST_GLOBS[@]}"; do
        # shellcheck disable=SC2053
        if [[ "$path" == $entry ]]; then
            return 0
        fi
    done
    return 1
}

is_gtfs_csv_filename() {
    local basename="$1"
    local entry
    for entry in "${GTFS_CSV_FILES[@]}"; do
        if [[ "$basename" == "$entry" ]]; then
            return 0
        fi
    done
    return 1
}

scan_path_slug() {
    local path="$1"
    local lower
    lower="$( printf '%s' "$path" | tr '[:upper:]' '[:lower:]' )"
    local slug
    for slug in "${PROVIDER_PATH_SLUGS[@]}"; do
        # Match slug as a word-ish segment in the path (avoid false-positives
        # like "movement" matching "mvg" by requiring non-letter boundary).
        if [[ "$lower" =~ (^|[^a-z])${slug}([^a-z]|$) ]]; then
            printf '%s' "$slug"
            return 0
        fi
    done
    return 1
}

scan_agency_content() {
    local path="$1"
    [[ -f "$path" && -r "$path" ]] || return 1
    local basename
    basename="$( basename "$path" )"
    is_gtfs_csv_filename "$basename" || return 1
    local name
    for name in "${PROVIDER_AGENCY_NAMES[@]}"; do
        if grep -F -q -- "$name" "$path" 2>/dev/null; then
            printf '%s' "$name"
            return 0
        fi
    done
    return 1
}

scan_sqlite_db() {
    local path="$1"
    [[ "$path" == *.db ]] || return 1
    # synthetic fixture .db is gitignored anyway, but defense-in-depth:
    if [[ "$path" == tests/fixtures/synthetic-gtfs/*.db ]]; then
        return 1
    fi
    return 0
}

collect_candidate_files() {
    # Collect candidate paths from staged + working-tree status, then
    # deduplicate while preserving order. Uses a flat string + grep for
    # dedup so the script works on bash 3.2 (macOS default).

    local seen=$'\n'
    local line status path

    if git rev-parse --git-dir >/dev/null 2>&1; then
        while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            path="$line"
            if [[ "$seen" != *$'\n'"$path"$'\n'* ]]; then
                seen="${seen}${path}"$'\n'
                printf '%s\n' "$path"
            fi
        done < <( git diff --cached --name-only --diff-filter=ACMR 2>/dev/null )

        # status --porcelain: format "XY path" — X=index, Y=worktree.
        # Use -uall so untracked directories are expanded to individual files
        # (default would summarize "?? somedir/").
        while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            status="${line:0:2}"
            path="${line:3}"
            # Strip surrounding quotes if git escaped a path with spaces
            path="${path#\"}"
            path="${path%\"}"
            # Skip deletions
            [[ "$status" == " D" || "$status" == "D " ]] && continue
            if [[ "$seen" != *$'\n'"$path"$'\n'* ]]; then
                seen="${seen}${path}"$'\n'
                printf '%s\n' "$path"
            fi
        done < <( git status --porcelain -uall 2>/dev/null )
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    local -a candidates=()
    local line
    while IFS= read -r line; do
        [[ -n "$line" ]] && candidates+=( "$line" )
    done < <( collect_candidate_files )

    local -a findings=()
    local path
    local candidate_count=${#candidates[@]}

    # Guard for bash 3.2: "${array[@]}" under `set -u` errors on empty arrays.
    if (( candidate_count > 0 )); then
    for path in "${candidates[@]}"; do
        if is_whitelisted "$path"; then
            continue
        fi

        local slug_hit
        if slug_hit=$( scan_path_slug "$path" ); then
            findings+=( "[path-slug:${slug_hit}] ${path}" )
            continue
        fi

        local name_hit
        if name_hit=$( scan_agency_content "$path" ); then
            findings+=( "[agency-name:${name_hit}] ${path}" )
            continue
        fi

        if scan_sqlite_db "$path"; then
            findings+=( "[sqlite-db] ${path}" )
            continue
        fi
    done
    fi  # candidate_count > 0

    local finding_count=${#findings[@]}
    if (( finding_count > 0 )); then
        printf 'ERROR: provider GTFS data detected in staged/untracked files.\n' >&2
        printf '       Memo 051 REV-04 Kap. 9.4 forbids redistributing third-party\n' >&2
        printf '       GTFS feeds in this public repo. Move the data outside the\n' >&2
        printf '       worktree (or add to .gitignore) before committing.\n\n' >&2
        printf 'Offending files (%d):\n' "$finding_count" >&2
        local entry
        for entry in "${findings[@]}"; do
            printf '  - %s\n' "$entry" >&2
        done
        exit 1
    fi

    printf 'OK: no provider GTFS data detected (%d files scanned).\n' "$candidate_count"
    exit 0
}

main "$@"
