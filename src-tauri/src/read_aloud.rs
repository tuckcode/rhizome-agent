use serde::Deserialize;

const SPEAK_URL: &str = "https://api.x.ai/v1/tts";
const MAX_CHARS: usize = 15_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakReplyArgs {
    pub text: String,
    pub voice_id: Option<String>,
    pub language: Option<String>,
}

pub fn validate_speak_request(args: &SpeakReplyArgs) -> Result<(String, String, String), String> {
    let text = args.text.trim();
    if text.is_empty() || text.chars().count() > MAX_CHARS {
        return Err("Read aloud text must be 1–15,000 characters.".into());
    }
    let voice = args
        .voice_id
        .as_deref()
        .unwrap_or("eve")
        .trim()
        .to_ascii_lowercase();
    if !is_voice_id(&voice) {
        return Err("Unknown voice.".into());
    }
    let language = args.language.as_deref().unwrap_or("auto").trim();
    if !is_language(language) {
        return Err("Unknown language.".into());
    }
    Ok((text.to_string(), voice, language.to_string()))
}

fn is_voice_id(value: &str) -> bool {
    let mut count = 0;
    for ch in value.chars() {
        count += 1;
        if count > 64 || !(ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-') {
            return false;
        }
    }
    count > 0
}

fn is_language(value: &str) -> bool {
    if value == "auto" {
        return true;
    }
    let mut parts = value.split('-');
    let Some(first) = parts.next() else {
        return false;
    };
    if first.len() < 2 || first.len() > 3 || !first.chars().all(|ch| ch.is_ascii_alphabetic()) {
        return false;
    }
    parts.all(|part| {
        (2..=8).contains(&part.len()) && part.chars().all(|ch| ch.is_ascii_alphanumeric())
    })
}

pub fn fetch_speech(text: &str, voice_id: &str, language: &str) -> Result<Vec<u8>, String> {
    let key = std::env::var("XAI_API_KEY")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Read aloud needs an xAI key on this machine.".to_string())?;

    let client = reqwest::blocking::Client::builder()
        .build()
        .map_err(|error| format!("Read aloud could not start: {error}"))?;
    let response = client
        .post(SPEAK_URL)
        .bearer_auth(key)
        .json(&serde_json::json!({
            "text": text,
            "voice_id": voice_id,
            "language": language,
        }))
        .send()
        .map_err(|error| format!("Read aloud failed: {error}"))?;

    let status = response.status();
    if status.as_u16() == 404 {
        return Err("Unknown voice.".into());
    }
    if !status.is_success() {
        return Err(format!("Read aloud failed ({status})."));
    }
    response
        .bytes()
        .map(|bytes| bytes.to_vec())
        .map_err(|error| format!("Read aloud failed: {error}"))
}

pub async fn speak_reply(args: SpeakReplyArgs) -> Result<Vec<u8>, String> {
    let (text, voice, language) = validate_speak_request(&args)?;
    tokio::task::spawn_blocking(move || fetch_speech(&text, &voice, &language))
        .await
        .map_err(|error| format!("Read aloud failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_a_blank_reply_and_an_unknown_voice_shape() {
        let blank = SpeakReplyArgs {
            text: "   ".into(),
            voice_id: None,
            language: None,
        };
        assert!(validate_speak_request(&blank).is_err());

        let bad_voice = SpeakReplyArgs {
            text: "Hello".into(),
            voice_id: Some("No Spaces".into()),
            language: Some("auto".into()),
        };
        assert!(validate_speak_request(&bad_voice).is_err());
    }

    #[test]
    fn accepts_the_default_voice_and_auto_language() {
        let args = SpeakReplyArgs {
            text: "Hello from read aloud.".into(),
            voice_id: None,
            language: None,
        };
        let (text, voice, language) = validate_speak_request(&args).unwrap();
        assert_eq!(text, "Hello from read aloud.");
        assert_eq!(voice, "eve");
        assert_eq!(language, "auto");
    }
}
