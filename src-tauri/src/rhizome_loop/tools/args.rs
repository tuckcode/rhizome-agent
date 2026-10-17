use serde_json::Value;

pub fn parse_object(raw: &str, tool: &str) -> Result<Value, String> {
    if raw.trim().is_empty() {
        return Ok(serde_json::json!({}));
    }
    let args: Value = serde_json::from_str(raw)
        .map_err(|error| format!("Failed to parse {tool} arguments: {error}"))?;
    if args.is_object() {
        Ok(args)
    } else {
        Err(format!("{tool} arguments must be a JSON object."))
    }
}

pub fn required_str<'a>(args: &'a Value, key: &str, tool: &str) -> Result<&'a str, String> {
    match optional_str(args, key) {
        Some(value) => Ok(value),
        None => Err(format!("{tool} requires {key}.")),
    }
}

pub fn optional_str<'a>(args: &'a Value, key: &str) -> Option<&'a str> {
    args.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

pub fn optional_usize(args: &Value, key: &str, tool: &str) -> Result<Option<usize>, String> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Number(number)) => number
            .as_u64()
            .map(|value| Some(value as usize))
            .ok_or_else(|| format!("{tool} {key} must be a non-negative integer.")),
        Some(Value::String(text)) => text
            .trim()
            .parse::<usize>()
            .map(Some)
            .map_err(|_| format!("{tool} {key} must be a non-negative integer.")),
        _ => Err(format!("{tool} {key} must be a non-negative integer.")),
    }
}

pub fn optional_bool(args: &Value, key: &str, tool: &str) -> Result<Option<bool>, String> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Bool(value)) => Ok(Some(*value)),
        _ => Err(format!("{tool} {key} must be a boolean.")),
    }
}

/// String field kept exactly as sent. Edit and write bodies must not
/// be trimmed; a trailing newline is content.
pub fn required_string<'a>(args: &'a Value, key: &str, tool: &str) -> Result<&'a str, String> {
    match args.get(key) {
        Some(Value::String(value)) => Ok(value.as_str()),
        None | Some(Value::Null) => Err(format!("{tool} requires {key}.")),
        _ => Err(format!("{tool} {key} must be a string.")),
    }
}

/// Path from a tool-args JSON blob. Used for session grants.
pub fn json_path(raw_args: &str) -> Option<String> {
    let args: Value = serde_json::from_str(raw_args).ok()?;
    args.get("path")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}
