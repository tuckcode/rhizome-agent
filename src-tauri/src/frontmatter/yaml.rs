use serde::{Deserialize, Serialize};

/// Value type for frontmatter updates
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum FrontmatterValue {
    String(String),
    Number(f64),
    Bool(bool),
    List(Vec<String>),
    Null,
}

#[derive(Clone, Copy)]
struct YamlText<'a>(&'a str);

impl<'a> YamlText<'a> {
    /// Characters that require a YAML string value to be quoted.
    fn has_special_chars(self) -> bool {
        self.0.contains(':') || self.0.contains('#')
    }

    /// Check if a string starts with a YAML collection indicator (array or map).
    fn starts_as_collection(self) -> bool {
        self.0.starts_with('[') || self.0.starts_with('{')
    }

    /// Check whether a YAML string value needs quoting to avoid ambiguity.
    fn needs_quoting(self) -> bool {
        self.has_special_chars()
            || self.starts_as_collection()
            || matches!(self.0, "true" | "false" | "null")
            || self.0.parse::<f64>().is_ok()
    }

    /// Quote a string value for YAML, escaping internal double quotes.
    fn quoted(self) -> String {
        format!("\"{}\"", self.0.replace('\"', "\\\""))
    }

    /// Format a single YAML list item as `  - "value"`.
    fn as_list_item(self) -> String {
        format!("  - {}", self.quoted())
    }

    /// Format a multi-line string as a YAML block scalar (`|`).
    /// Each line is indented by 2 spaces; empty lines are preserved as blank.
    fn as_block_scalar(self) -> String {
        let indented = self
            .0
            .lines()
            .map(|line| {
                if line.is_empty() {
                    String::new()
                } else {
                    format!("  {}", line)
                }
            })
            .collect::<Vec<_>>()
            .join("\n");
        format!("|\n{}", indented)
    }

    /// Check whether a YAML key needs quoting (contains spaces, special chars, etc.).
    fn needs_key_quoting(self) -> bool {
        self.0
            .chars()
            .any(|c| !c.is_ascii_alphanumeric() && c != '_' && c != '-')
    }
}

/// Format a key for YAML output (quote if necessary)
pub fn format_yaml_key(key: &str) -> String {
    let yaml_key = YamlText(key);
    if yaml_key.needs_key_quoting() {
        yaml_key.quoted()
    } else {
        key.to_string()
    }
}

/// Format a number for YAML (integers without decimal, floats with).
fn format_yaml_number(n: f64) -> String {
    if n.fract() == 0.0 {
        format!("{}", n as i64)
    } else {
        format!("{}", n)
    }
}

impl FrontmatterValue {
    pub fn to_yaml_value(&self) -> String {
        match self {
            FrontmatterValue::String(s) => {
                let yaml_text = YamlText(s);
                if s.contains('\n') {
                    yaml_text.as_block_scalar()
                } else if yaml_text.needs_quoting() {
                    yaml_text.quoted()
                } else {
                    s.clone()
                }
            }
            FrontmatterValue::Number(n) => format_yaml_number(*n),
            FrontmatterValue::Bool(b) => if *b { "true" } else { "false" }.to_string(),
            FrontmatterValue::List(items) if items.is_empty() => "[]".to_string(),
            FrontmatterValue::List(items) => items
                .iter()
                .map(|item| YamlText(item).as_list_item())
                .collect::<Vec<_>>()
                .join("\n"),
            FrontmatterValue::Null => "null".to_string(),
        }
    }
}

/// Format a key-value pair as one or more YAML lines.
pub fn format_yaml_field(key: &str, value: &FrontmatterValue) -> Vec<String> {
    let yaml_key = format_yaml_key(key);
    let yaml_value = value.to_yaml_value();
    if yaml_value.starts_with("|\n") {
        // Block scalar: key and indicator on the same line, content follows
        vec![format!("{}: {}", yaml_key, yaml_value)]
    } else if matches!(value, FrontmatterValue::List(items) if !items.is_empty()) {
        vec![format!("{}:", yaml_key), yaml_value]
    } else {
        vec![format!("{}: {}", yaml_key, yaml_value)]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_string_yaml_value(input: &str, expected: &str) {
        let value = FrontmatterValue::String(input.to_string());
        assert_eq!(value.to_yaml_value(), expected);
    }

    fn assert_field_lines(key: &str, value: FrontmatterValue, expected: &[&str]) {
        let lines = format_yaml_field(key, &value);
        let expected_lines = expected
            .iter()
            .map(|line| line.to_string())
            .collect::<Vec<_>>();
        assert_eq!(lines, expected_lines);
    }

    #[test]
    fn test_to_yaml_value_string_needs_quoting_cases() {
        for (input, expected) in [
            ("key: value", "\"key: value\""),
            ("has # comment", "\"has # comment\""),
            ("[array-like]", "\"[array-like]\""),
            ("{object-like}", "\"{object-like}\""),
            ("true", "\"true\""),
            ("false", "\"false\""),
            ("null", "\"null\""),
            ("42", "\"42\""),
            ("3.14", "\"3.14\""),
        ] {
            assert_string_yaml_value(input, expected);
        }
    }

    #[test]
    fn test_to_yaml_value_string_plain() {
        assert_string_yaml_value("Hello World", "Hello World");
    }

    #[test]
    fn test_to_yaml_value_number_integer() {
        let v = FrontmatterValue::Number(42.0);
        assert_eq!(v.to_yaml_value(), "42");
    }

    #[test]
    fn test_to_yaml_value_number_float() {
        let v = FrontmatterValue::Number(3.125);
        assert_eq!(v.to_yaml_value(), "3.125");
    }

    #[test]
    fn test_to_yaml_value_null() {
        assert_eq!(FrontmatterValue::Null.to_yaml_value(), "null");
    }

    #[test]
    fn test_to_yaml_value_empty_list() {
        let v = FrontmatterValue::List(vec![]);
        assert_eq!(v.to_yaml_value(), "[]");
    }

    #[test]
    fn test_to_yaml_value_list_with_colon() {
        let v = FrontmatterValue::List(vec!["key: value".to_string()]);
        assert_eq!(v.to_yaml_value(), "  - \"key: value\"");
    }

    #[test]
    fn test_to_yaml_value_multiline_uses_block_scalar() {
        let v = FrontmatterValue::String("line 1\nline 2\nline 3".to_string());
        let yaml = v.to_yaml_value();
        assert!(yaml.starts_with("|\n"));
        assert!(yaml.contains("  line 1"));
        assert!(yaml.contains("  line 2"));
    }

    #[test]
    fn test_format_yaml_key_simple() {
        for (input, expected) in [("Status", "Status"), ("is_a", "is_a")] {
            assert_eq!(format_yaml_key(input), expected);
        }
    }

    #[test]
    fn test_format_yaml_key_quotes_when_needed() {
        for (input, expected) in [
            ("Is A", "\"Is A\""),
            ("Created at", "\"Created at\""),
            ("key:value", "\"key:value\""),
            ("has#tag", "\"has#tag\""),
            ("key.name", "\"key.name\""),
        ] {
            assert_eq!(format_yaml_key(input), expected);
        }
    }

    #[test]
    fn test_format_yaml_field_block_scalar() {
        let v = FrontmatterValue::String("## Objective\n\n## Timeline".to_string());
        let lines = format_yaml_field("template", &v);
        assert_eq!(lines.len(), 1);
        assert!(lines[0].starts_with("template: |\n"));
        assert!(lines[0].contains("  ## Objective"));
        assert!(lines[0].contains("  ## Timeline"));
    }

    #[test]
    fn test_format_yaml_field_list_layouts() {
        assert_field_lines(
            "_list_properties_display",
            FrontmatterValue::List(vec!["Belongs to".to_string()]),
            &["_list_properties_display:", "  - \"Belongs to\""],
        );
        assert_field_lines("tags", FrontmatterValue::List(vec![]), &["tags: []"]);
        assert_field_lines(
            "tags",
            FrontmatterValue::List(vec!["Alpha".to_string(), "Beta".to_string()]),
            &["tags:", "  - \"Alpha\"\n  - \"Beta\""],
        );
    }
}
