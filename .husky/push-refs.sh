# Ref check for the pre-push hook. Sourced by `.husky/pre-push` and by
# `src/lib/prePushRefs.test.ts`.
#
# Input: CURRENT_BRANCH, and PUSH_INPUT (the lines git sends to pre-push on
# stdin). Output: IS_PROTOTYPE_BRANCH. A refused ref exits 1. ADR-0181.
#
# A `prototype/*` branch is throwaway code kept as a primary source: the
# measurement or spike that settled a decision, parked out of main so the
# number can be re-run later instead of re-derived. It never merges, so the
# full gate suite does not cover it, since prototype code is written without
# tests or error handling by design. See `docs/adr/` and the `prototype` skill.
#
# Any other branch is a PR branch. Agents open PRs and knispo merges them
# (ADR-0181), so a PR branch must be pushable. It gets the full gate suite,
# the same as main. It may only push to the remote branch of the same name,
# so it can never write main. Before 2026-10-10 this hook refused every PR
# branch. PRs reached GitHub only on clones where `.husky/_/pre-push` was
# missing, which also skipped every gate.

reject_push_ref() {
  echo "❌ Pushes must be main -> main, a tag, or a branch -> the remote branch of the same name."
  echo "   Attempted: ${LOCAL_REF:-<none>} -> ${REMOTE_REF:-<none>}"
  exit 1
}

check_push_refs() {
  IS_PROTOTYPE_BRANCH=false
  case "$CURRENT_BRANCH" in
    prototype/*)
      IS_PROTOTYPE_BRANCH=true
      ;;
  esac

  while IFS=' ' read -r LOCAL_REF LOCAL_SHA REMOTE_REF REMOTE_SHA; do
    [ -z "$LOCAL_REF" ] && continue

    # Skip the gates only when every pushed ref is a prototype ref. From a
    # prototype checkout, `git push origin main` still runs the full suite.
    case "$REMOTE_REF" in
      refs/heads/prototype/*) ;;
      *) IS_PROTOTYPE_BRANCH=false ;;
    esac

    case "$LOCAL_REF:$REMOTE_REF" in
      refs/heads/main:refs/heads/main)
        ;;
      HEAD:refs/heads/main)
        ;;
      refs/tags/*:refs/tags/*)
        ;;
      refs/heads/*:refs/heads/*)
        # main -> main matched above, so a name mismatch here includes
        # every attempt to write main from another branch.
        [ "$LOCAL_REF" = "$REMOTE_REF" ] || reject_push_ref
        ;;
      *)
        reject_push_ref
        ;;
    esac
  done <<EOF
$PUSH_INPUT
EOF
}
