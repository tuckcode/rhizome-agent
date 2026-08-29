use std::path::Path;

/// Whether a path is a saved view definition.
///
/// All that remains of this module. It used to also migrate views out of
/// `.laputa/views` into `views/` — a directory named two renames ago, which
/// exists on no machine that runs this app (checked 2026-08-29 across the
/// real vault and both demo fixtures). Deleted with the rest of the
/// single-user compatibility code, #57.
pub(super) fn is_view_definition_file(path: &Path) -> bool {
    path.extension().and_then(|ext| ext.to_str()) == Some("yml")
}
