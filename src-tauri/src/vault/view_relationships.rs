use super::view_value_conversions::{yaml_value_to_string, yaml_value_to_string_vec};
use super::views::FilterOp;

pub(super) fn relationship_candidates(link: &str) -> Vec<String> {
    RelationshipLink::new(link).candidates()
}

pub(super) fn evaluate_relationship_op(
    op: &FilterOp,
    rels: &[String],
    value: &Option<serde_yaml::Value>,
) -> bool {
    let relationships = Relationships::new(rels);
    match op {
        FilterOp::Contains => {
            relationship_target(value).is_some_and(|target| relationships.contains(&target))
        }
        FilterOp::NotContains => {
            relationship_target(value).map_or(true, |target| !relationships.contains(&target))
        }
        FilterOp::AnyOf => relationships.matches_any(&relationship_values(value)),
        FilterOp::NoneOf => !relationships.matches_any(&relationship_values(value)),
        FilterOp::IsEmpty => relationships.is_empty(),
        FilterOp::IsNotEmpty => !relationships.is_empty(),
        FilterOp::Equals => relationship_target(value).map_or_else(
            || relationships.is_empty(),
            |target| relationships.equals(&target),
        ),
        FilterOp::NotEquals => relationship_target(value).map_or_else(
            || !relationships.is_empty(),
            |target| !relationships.equals(&target),
        ),
        _ => false,
    }
}

struct Relationships<'a> {
    values: &'a [String],
}

impl<'a> Relationships<'a> {
    fn new(values: &'a [String]) -> Self {
        Self { values }
    }

    fn is_empty(&self) -> bool {
        self.values.is_empty()
    }

    fn contains(&self, target: &RelationshipTarget) -> bool {
        self.values
            .iter()
            .any(|relationship| target.matches(RelationshipLink::new(relationship)))
    }

    fn matches_any(&self, targets: &RelationshipTargets) -> bool {
        self.values
            .iter()
            .any(|relationship| targets.matches(RelationshipLink::new(relationship)))
    }

    fn equals(&self, target: &RelationshipTarget) -> bool {
        self.values.len() == 1 && self.contains(target)
    }
}

struct RelationshipTarget {
    value: String,
}

impl RelationshipTarget {
    fn new(value: String) -> Self {
        Self { value }
    }

    fn matches(&self, relationship: RelationshipLink<'_>) -> bool {
        self.as_link().normalized_stem() == relationship.normalized_stem()
    }

    fn as_link(&self) -> RelationshipLink<'_> {
        RelationshipLink::new(&self.value)
    }
}

struct RelationshipTargets {
    values: Vec<RelationshipTarget>,
}

impl RelationshipTargets {
    fn new(values: Vec<RelationshipTarget>) -> Self {
        Self { values }
    }

    fn matches(&self, relationship: RelationshipLink<'_>) -> bool {
        let relationship_stem = relationship.normalized_stem();
        self.values
            .iter()
            .any(|value| value.as_link().normalized_stem() == relationship_stem)
    }
}

struct RelationshipLink<'a> {
    value: &'a str,
}

impl<'a> RelationshipLink<'a> {
    fn new(value: &'a str) -> Self {
        Self { value }
    }

    fn candidates(&self) -> Vec<String> {
        let trimmed = self.value.trim();
        match self.inner().split_once('|') {
            Some((stem, alias)) => vec![trimmed.to_string(), stem.to_string(), alias.to_string()],
            None => vec![trimmed.to_string(), self.inner().to_string()],
        }
    }

    fn normalized_stem(&self) -> String {
        self.stem().to_lowercase()
    }

    fn stem(&self) -> &str {
        match self.inner().split_once('|') {
            Some((stem, _)) => stem,
            None => self.inner(),
        }
    }

    fn inner(&self) -> &str {
        let trimmed = self.value.trim();
        trimmed
            .strip_prefix("[[")
            .unwrap_or(trimmed)
            .strip_suffix("]]")
            .unwrap_or(trimmed)
    }
}

fn relationship_target(value: &Option<serde_yaml::Value>) -> Option<RelationshipTarget> {
    value
        .as_ref()
        .and_then(yaml_value_to_string)
        .map(RelationshipTarget::new)
}

fn relationship_values(value: &Option<serde_yaml::Value>) -> RelationshipTargets {
    let values = value
        .as_ref()
        .and_then(yaml_value_to_string_vec)
        .unwrap_or_default()
        .into_iter()
        .map(RelationshipTarget::new)
        .collect();
    RelationshipTargets::new(values)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rels(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    fn scalar(value: &str) -> Option<serde_yaml::Value> {
        Some(serde_yaml::Value::String(value.into()))
    }

    fn list(values: &[&str]) -> Option<serde_yaml::Value> {
        Some(serde_yaml::Value::Sequence(
            values
                .iter()
                .map(|value| serde_yaml::Value::String((*value).into()))
                .collect(),
        ))
    }

    #[test]
    fn candidates_offer_the_raw_link_its_stem_and_any_alias() {
        assert_eq!(
            relationship_candidates("[[Alice|Al]]"),
            vec!["[[Alice|Al]]", "Alice", "Al"]
        );
        assert_eq!(
            relationship_candidates("[[Alice]]"),
            vec!["[[Alice]]", "Alice"]
        );
        assert_eq!(relationship_candidates("Alice"), vec!["Alice", "Alice"]);
        assert_eq!(
            relationship_candidates("  [[Alice]]  "),
            vec!["[[Alice]]", "Alice"]
        );
    }

    /// Brackets, aliases, surrounding space and case are all normalized away
    /// before comparison, so a frontmatter value matches however it was typed.
    #[test]
    fn a_link_matches_its_target_regardless_of_brackets_alias_or_case() {
        for relationship in ["[[Alice]]", "Alice", "  [[Alice]] ", "[[Alice|Al]]"] {
            assert!(
                evaluate_relationship_op(
                    &FilterOp::Contains,
                    &rels(&[relationship]),
                    &scalar("alice")
                ),
                "{relationship} should match a lowercase target"
            );
        }
    }

    #[test]
    fn contains_and_not_contains_are_opposites_when_a_target_is_given() {
        let values = rels(&["[[Alice]]", "[[Bob]]"]);
        assert!(evaluate_relationship_op(
            &FilterOp::Contains,
            &values,
            &scalar("Bob")
        ));
        assert!(!evaluate_relationship_op(
            &FilterOp::Contains,
            &values,
            &scalar("Carol")
        ));
        assert!(!evaluate_relationship_op(
            &FilterOp::NotContains,
            &values,
            &scalar("Bob")
        ));
        assert!(evaluate_relationship_op(
            &FilterOp::NotContains,
            &values,
            &scalar("Carol")
        ));
    }

    /// With no target to compare against, `contains` fails closed and
    /// `not_contains` passes — the note trivially does not contain "nothing".
    #[test]
    fn a_missing_target_fails_contains_and_passes_not_contains() {
        let values = rels(&["[[Alice]]"]);
        assert!(!evaluate_relationship_op(
            &FilterOp::Contains,
            &values,
            &None
        ));
        assert!(evaluate_relationship_op(
            &FilterOp::NotContains,
            &values,
            &None
        ));
    }

    #[test]
    fn any_of_and_none_of_read_a_list_of_targets() {
        let values = rels(&["[[Alice]]"]);
        assert!(evaluate_relationship_op(
            &FilterOp::AnyOf,
            &values,
            &list(&["Bob", "Alice"])
        ));
        assert!(!evaluate_relationship_op(
            &FilterOp::AnyOf,
            &values,
            &list(&["Bob", "Carol"])
        ));
        assert!(!evaluate_relationship_op(
            &FilterOp::NoneOf,
            &values,
            &list(&["Bob", "Alice"])
        ));
        assert!(evaluate_relationship_op(
            &FilterOp::NoneOf,
            &values,
            &list(&["Bob", "Carol"])
        ));
    }

    /// A scalar where a list is expected yields no targets, so nothing can
    /// match — `any_of` is false and `none_of` is vacuously true.
    #[test]
    fn any_of_given_a_scalar_matches_nothing() {
        let values = rels(&["[[Alice]]"]);
        assert!(!evaluate_relationship_op(
            &FilterOp::AnyOf,
            &values,
            &scalar("Alice")
        ));
        assert!(evaluate_relationship_op(
            &FilterOp::NoneOf,
            &values,
            &scalar("Alice")
        ));
    }

    #[test]
    fn emptiness_ignores_the_target_entirely() {
        assert!(evaluate_relationship_op(&FilterOp::IsEmpty, &[], &None));
        assert!(!evaluate_relationship_op(
            &FilterOp::IsEmpty,
            &rels(&["[[Alice]]"]),
            &None
        ));
        assert!(!evaluate_relationship_op(&FilterOp::IsNotEmpty, &[], &None));
        assert!(evaluate_relationship_op(
            &FilterOp::IsNotEmpty,
            &rels(&["[[Alice]]"]),
            &scalar("ignored")
        ));
    }

    /// `equals` is "this is the only relationship", so a second one fails it
    /// even when the target is present — that is what separates it from
    /// `contains`.
    #[test]
    fn equals_requires_the_target_to_be_the_only_relationship() {
        assert!(evaluate_relationship_op(
            &FilterOp::Equals,
            &rels(&["[[Alice]]"]),
            &scalar("Alice")
        ));
        assert!(!evaluate_relationship_op(
            &FilterOp::Equals,
            &rels(&["[[Alice]]", "[[Bob]]"]),
            &scalar("Alice")
        ));
        assert!(evaluate_relationship_op(
            &FilterOp::NotEquals,
            &rels(&["[[Alice]]", "[[Bob]]"]),
            &scalar("Alice")
        ));
    }

    /// With no target, `equals` degenerates to an emptiness check.
    #[test]
    fn equals_without_a_target_asks_whether_there_are_no_relationships() {
        assert!(evaluate_relationship_op(&FilterOp::Equals, &[], &None));
        assert!(!evaluate_relationship_op(
            &FilterOp::Equals,
            &rels(&["[[Alice]]"]),
            &None
        ));
        assert!(!evaluate_relationship_op(&FilterOp::NotEquals, &[], &None));
        assert!(evaluate_relationship_op(
            &FilterOp::NotEquals,
            &rels(&["[[Alice]]"]),
            &None
        ));
    }

    /// Date operators are meaningless for relationships and must not silently
    /// behave like a match.
    #[test]
    fn date_operators_never_match_a_relationship() {
        let values = rels(&["[[Alice]]"]);
        assert!(!evaluate_relationship_op(
            &FilterOp::Before,
            &values,
            &scalar("Alice")
        ));
        assert!(!evaluate_relationship_op(
            &FilterOp::After,
            &values,
            &scalar("Alice")
        ));
    }
}
