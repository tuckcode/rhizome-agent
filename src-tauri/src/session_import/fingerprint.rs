//! Content fingerprints for import deduplication.
//!
//! Two exports of the same conversation — from different apps, or the same app
//! twice — have to hash identically, or the same thread lands in Rhizome twice
//! under different names. Everything here runs *after* redaction, so a
//! fingerprint never depends on a credential we stripped.

use serde::Serialize;
use sha2::{Digest, Sha256};

/// One message as an adapter hands it over, before any normalization.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportedMessage {
    pub role: String,
    pub content: String,
}

impl ImportedMessage {
    pub fn new(role: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            role: role.into(),
            content: content.into(),
        }
    }
}

/// Inclusive day-granularity span of a conversation, when the source reports it.
///
/// Day granularity on purpose: exporters disagree about sub-second timestamps
/// and timezone rendering for the same conversation, so anything finer makes
/// two copies of one thread hash differently.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct DateSpan {
    pub first_day: i64,
    pub last_day: i64,
}

#[derive(Serialize)]
struct FingerprintInput<'a> {
    messages: &'a [String],
    count: usize,
    date_span: Option<DateSpan>,
}

/// Strip zero-width characters and collapse runs of whitespace to one space.
///
/// Zero-width joiners and BOMs survive copy-paste through some exporters and
/// not others; leading/trailing and repeated whitespace differ by exporter for
/// the same text. Neither changes what the message says.
///
/// **Known gap:** the plan also calls for Unicode NFC normalization, so that a
/// composed `é` and a decomposed `e` + combining accent hash alike. That needs
/// the `unicode-normalization` crate, which is not currently a dependency, so
/// it is deliberately not done here rather than added silently. Two exports
/// that disagree only on composition will currently produce two entries.
pub fn normalize_content(content: &str) -> String {
    let without_zero_width: String = content
        .chars()
        .filter(|character| !is_zero_width(*character))
        .collect();
    without_zero_width
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_zero_width(character: char) -> bool {
    matches!(
        character,
        '\u{200B}' | '\u{200C}' | '\u{200D}' | '\u{2060}' | '\u{FEFF}'
    )
}

fn normalized_lines(messages: &[ImportedMessage]) -> Vec<String> {
    messages
        .iter()
        .map(|message| format!("{}\n{}", message.role, normalize_content(&message.content)))
        .collect()
}

fn hash_of(input: &FingerprintInput<'_>) -> String {
    // serde_json with a fixed struct field order is the stable serialization the
    // plan asks for: no map iteration order to vary between runs.
    let serialized = serde_json::to_string(input).unwrap_or_default();
    let digest = Sha256::digest(serialized.as_bytes());
    format!("sha256:{digest:x}")
}

/// Fingerprint of a whole conversation, as stored in the ledger.
pub fn content_fingerprint(messages: &[ImportedMessage], date_span: Option<DateSpan>) -> String {
    let lines = normalized_lines(messages);
    hash_of(&FingerprintInput {
        messages: &lines,
        count: messages.len(),
        date_span,
    })
}

/// Fingerprint of the first three and last message, for the fuzzy dedup step.
///
/// One export truncating trailing messages is the common near-miss, so the
/// opening of a thread plus its latest message identifies it well enough to ask
/// the user about. Deliberately excludes the count and date span, which are
/// exactly what differ when a copy is truncated.
pub fn fuzzy_fingerprint(messages: &[ImportedMessage]) -> String {
    let mut sampled: Vec<String> = normalized_lines(messages).into_iter().take(3).collect();
    if messages.len() > 3 {
        if let Some(last) = normalized_lines(messages).pop() {
            sampled.push(last);
        }
    }
    hash_of(&FingerprintInput {
        messages: &sampled,
        count: 0,
        date_span: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conversation() -> Vec<ImportedMessage> {
        vec![
            ImportedMessage::new("user", "How do wikilinks work?"),
            ImportedMessage::new("assistant", "They link notes by title."),
            ImportedMessage::new("user", "Thanks"),
        ]
    }

    #[test]
    fn collapses_whitespace_and_strips_zero_width_characters() {
        assert_eq!(normalize_content("  hello   world \n"), "hello world");
        assert_eq!(normalize_content("he\u{200B}llo"), "hello");
        assert_eq!(normalize_content("\u{FEFF}hi"), "hi");
    }

    #[test]
    fn is_stable_for_the_same_conversation() {
        assert_eq!(
            content_fingerprint(&conversation(), None),
            content_fingerprint(&conversation(), None),
        );
    }

    /// The point of normalizing: two exporters rendering the same thread with
    /// different spacing must not import twice.
    #[test]
    fn ignores_exporter_whitespace_differences() {
        let spaced = vec![
            ImportedMessage::new("user", "How do wikilinks work?\n"),
            ImportedMessage::new("assistant", "They  link notes by title."),
            ImportedMessage::new("user", "  Thanks  "),
        ];

        assert_eq!(
            content_fingerprint(&conversation(), None),
            content_fingerprint(&spaced, None),
        );
    }

    #[test]
    fn separates_conversations_that_differ_in_content_role_or_length() {
        let baseline = content_fingerprint(&conversation(), None);

        let mut different_content = conversation();
        different_content[1] = ImportedMessage::new("assistant", "They do not.");
        assert_ne!(baseline, content_fingerprint(&different_content, None));

        let mut different_role = conversation();
        different_role[0] = ImportedMessage::new("assistant", "How do wikilinks work?");
        assert_ne!(baseline, content_fingerprint(&different_role, None));

        let truncated = &conversation()[..2];
        assert_ne!(baseline, content_fingerprint(truncated, None));
    }

    /// Included so a truncated export does not silently match a full one on
    /// the strict fingerprint — that is what the fuzzy step is for.
    #[test]
    fn separates_conversations_that_differ_only_in_date_span() {
        let span = DateSpan {
            first_day: 20_000,
            last_day: 20_001,
        };
        let later = DateSpan {
            first_day: 20_005,
            last_day: 20_006,
        };

        assert_ne!(
            content_fingerprint(&conversation(), Some(span)),
            content_fingerprint(&conversation(), Some(later)),
        );
        assert_ne!(
            content_fingerprint(&conversation(), Some(span)),
            content_fingerprint(&conversation(), None),
        );
    }

    #[test]
    fn fuzzy_fingerprint_survives_a_truncated_tail() {
        let full = vec![
            ImportedMessage::new("user", "one"),
            ImportedMessage::new("assistant", "two"),
            ImportedMessage::new("user", "three"),
            ImportedMessage::new("assistant", "four"),
            ImportedMessage::new("user", "five"),
        ];
        // Same opening and same latest message, one dropped in the middle.
        let truncated = vec![
            ImportedMessage::new("user", "one"),
            ImportedMessage::new("assistant", "two"),
            ImportedMessage::new("user", "three"),
            ImportedMessage::new("user", "five"),
        ];

        assert_eq!(fuzzy_fingerprint(&full), fuzzy_fingerprint(&truncated));
        assert_ne!(
            content_fingerprint(&full, None),
            content_fingerprint(&truncated, None),
        );
    }

    #[test]
    fn fuzzy_fingerprint_separates_unrelated_conversations() {
        let other = vec![
            ImportedMessage::new("user", "totally different"),
            ImportedMessage::new("assistant", "yes"),
            ImportedMessage::new("user", "ok"),
        ];

        assert_ne!(
            fuzzy_fingerprint(&conversation()),
            fuzzy_fingerprint(&other)
        );
    }

    #[test]
    fn fuzzy_fingerprint_handles_conversations_shorter_than_the_sample() {
        let single = vec![ImportedMessage::new("user", "hi")];

        assert_eq!(fuzzy_fingerprint(&single), fuzzy_fingerprint(&single));
        assert_ne!(
            fuzzy_fingerprint(&single),
            fuzzy_fingerprint(&conversation())
        );
    }
}
