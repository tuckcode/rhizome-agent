pub(super) fn json_scalar_to_string(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(value) => Some(value.clone()),
        serde_json::Value::Number(value) => Some(value.to_string()),
        serde_json::Value::Bool(value) => Some(value.to_string()),
        _ => None,
    }
}

pub(super) fn json_scalar_array_to_strings(value: &serde_json::Value) -> Option<Vec<String>> {
    value
        .as_array()
        .map(|sequence| sequence.iter().filter_map(json_scalar_to_string).collect())
}

pub(super) fn yaml_value_to_string(value: &serde_yaml::Value) -> Option<String> {
    match value {
        serde_yaml::Value::String(value) => Some(value.clone()),
        serde_yaml::Value::Number(value) => Some(value.to_string()),
        serde_yaml::Value::Bool(value) => Some(value.to_string()),
        _ => None,
    }
}

pub(super) fn yaml_value_to_string_vec(value: &serde_yaml::Value) -> Option<Vec<String>> {
    value
        .as_sequence()
        .map(|sequence| sequence.iter().filter_map(yaml_value_to_string).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_scalars_stringify_and_containers_do_not() {
        assert_eq!(
            json_scalar_to_string(&serde_json::json!("alice")),
            Some("alice".to_string())
        );
        assert_eq!(
            json_scalar_to_string(&serde_json::json!(42)),
            Some("42".to_string())
        );
        assert_eq!(
            json_scalar_to_string(&serde_json::json!(true)),
            Some("true".to_string())
        );

        // Null and containers are absent values, not the strings "null"/"[]".
        assert_eq!(json_scalar_to_string(&serde_json::json!(null)), None);
        assert_eq!(json_scalar_to_string(&serde_json::json!([1])), None);
        assert_eq!(json_scalar_to_string(&serde_json::json!({"a": 1})), None);
    }

    #[test]
    fn a_json_array_keeps_its_scalars_and_silently_drops_the_rest() {
        assert_eq!(
            json_scalar_array_to_strings(&serde_json::json!(["a", 1, false, null, ["nested"]])),
            Some(vec!["a".to_string(), "1".to_string(), "false".to_string()])
        );
        assert_eq!(
            json_scalar_array_to_strings(&serde_json::json!([])),
            Some(vec![])
        );
    }

    /// A non-array is `None` (field absent), distinct from an empty array
    /// (`Some(vec![])`) — filters treat those two differently.
    #[test]
    fn a_json_non_array_is_none_rather_than_an_empty_list() {
        assert_eq!(json_scalar_array_to_strings(&serde_json::json!("a")), None);
        assert_eq!(json_scalar_array_to_strings(&serde_json::json!(null)), None);
    }

    #[test]
    fn yaml_scalars_stringify_and_containers_do_not() {
        assert_eq!(
            yaml_value_to_string(&serde_yaml::Value::String("alice".into())),
            Some("alice".to_string())
        );
        assert_eq!(
            yaml_value_to_string(&serde_yaml::Value::Number(7.into())),
            Some("7".to_string())
        );
        assert_eq!(
            yaml_value_to_string(&serde_yaml::Value::Bool(false)),
            Some("false".to_string())
        );
        assert_eq!(yaml_value_to_string(&serde_yaml::Value::Null), None);
        assert_eq!(
            yaml_value_to_string(&serde_yaml::Value::Sequence(vec![])),
            None
        );
    }

    #[test]
    fn a_yaml_sequence_keeps_its_scalars_and_silently_drops_the_rest() {
        let sequence = serde_yaml::Value::Sequence(vec![
            serde_yaml::Value::String("a".into()),
            serde_yaml::Value::Number(2.into()),
            serde_yaml::Value::Null,
            serde_yaml::Value::Sequence(vec![]),
        ]);
        assert_eq!(
            yaml_value_to_string_vec(&sequence),
            Some(vec!["a".to_string(), "2".to_string()])
        );
    }

    #[test]
    fn a_yaml_non_sequence_is_none_rather_than_an_empty_list() {
        assert_eq!(
            yaml_value_to_string_vec(&serde_yaml::Value::String("a".into())),
            None
        );
        assert_eq!(yaml_value_to_string_vec(&serde_yaml::Value::Null), None);
    }
}
