//! Free-tier provider routing (harness plan Phase 4b, ADR-0182).
//!
//! Compiles in normal builds, like `rhizome_loop`. Chat does not call it
//! until Phase 6.
//!
//! `RoutingModel` is one loop `Model`. Each step it walks the pinned
//! catalog in fixed priority order and skips any target that a health layer
//! blocks (see `health`). It sends the step through one `ProviderModel`,
//! retargeted per attempt, so the turn mark survives a failover.
//!
//! A failover happens only before the first event reaches the loop. After
//! text or a tool call went out, a later error ends the step: the loop
//! already saw partial output.

mod catalog;
pub mod free_tier;
mod health;

use std::hash::{Hash, Hasher};

use serde_json::json;

use crate::ai_models::{AiModelStreamRequest, HttpLimits};
use crate::model_events::{ModelError, ModelErrorKind, ModelEvent};
use crate::rhizome_loop::{Model, ModelView};
use crate::rhizome_provider_model::ProviderModel;

pub use catalog::{
    Catalog, CatalogModel, CatalogProvider, CatalogSource, RoutingOptions, Target, UserEndpoint,
    USER_ENDPOINT_ID,
};
use health::{Attempt, Health, Millis};

/// freellmapi checklist: the overall retry budget for one step.
pub const RETRY_BUDGET: Millis = 45_000;

/// One provider's secret. Cloudflare also needs the account id.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Credential {
    pub api_key: String,
    pub account_id: Option<String>,
}

/// Where keys come from. One key per provider (ADR-0182 decision 4). The OS
/// keychain implements this later. Tests use a map.
pub trait KeyStore: Send {
    fn credential(&self, provider_id: &str) -> Option<Credential>;

    /// Like `credential`, but a store that cannot be read (a locked or
    /// denied keychain) says so in place of reporting "no key".
    fn try_credential(&self, provider_id: &str) -> Result<Option<Credential>, String> {
        Ok(self.credential(provider_id))
    }
}

/// Wall time in milliseconds since the Unix epoch. Daily limits reset at
/// UTC midnight, so this is wall time, not a monotonic clock.
pub trait Clock: Send {
    fn now_ms(&self) -> Millis;
}

pub struct SystemClock;

impl Clock for SystemClock {
    fn now_ms(&self) -> Millis {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |elapsed| elapsed.as_millis() as Millis)
    }
}

/// One routing fact for the UI: which provider the router tried, and what
/// happened. It is live coordination. The model does not see it, so the
/// loop does not log it. `reason` is an error class, never a response body.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum ProviderAttempt {
    /// The router sent the step to this target.
    Trying {
        provider_id: String,
        model_id: String,
    },
    /// The target failed before any output, so the router moves on.
    FailedOver {
        provider_id: String,
        model_id: String,
        reason: ModelErrorKind,
    },
    /// The first output from this target reached the loop.
    Answered {
        provider_id: String,
        model_id: String,
    },
    /// The target failed after the loop saw output. No failover follows.
    FailedAfterOutput {
        provider_id: String,
        model_id: String,
        reason: ModelErrorKind,
    },
    /// No target finished the step.
    Exhausted { reason: ModelErrorKind },
}

type AttemptObserver = Box<dyn FnMut(ProviderAttempt) + Send>;

/// Routes each loop step to the first healthy free-tier target.
pub struct RoutingModel<K: KeyStore, C: Clock> {
    catalog: Catalog,
    options: RoutingOptions,
    keys: K,
    clock: C,
    health: Health,
    budget: Millis,
    limits: HttpLimits,
    inner: Option<ProviderModel>,
    observer: Option<AttemptObserver>,
    system_prompt: Option<String>,
    reasoning_slot: Option<crate::reasoning_levels::ReasoningLevelSlot>,
    reasoning_notice_tx:
        Option<std::sync::mpsc::Sender<crate::reasoning_levels::ReasoningLevelNotice>>,
    reasoning_notices_seen:
        Option<std::sync::Arc<std::sync::Mutex<std::collections::HashSet<String>>>>,
    chat_images: Vec<Vec<crate::chat_images::ChatImage>>,
    send_anyway: bool,
    image_session_id: Option<String>,
}

impl<K: KeyStore, C: Clock> RoutingModel<K, C> {
    pub fn new(catalog: Catalog, keys: K, clock: C, limits: HttpLimits) -> Self {
        Self {
            catalog,
            options: RoutingOptions::default(),
            keys,
            clock,
            health: Health::default(),
            budget: RETRY_BUDGET,
            limits,
            inner: None,
            observer: None,
            system_prompt: None,
            reasoning_slot: None,
            reasoning_notice_tx: None,
            reasoning_notices_seen: None,
            chat_images: Vec::new(),
            send_anyway: false,
            image_session_id: None,
        }
    }

    pub fn with_chat_images(mut self, images: Vec<Vec<crate::chat_images::ChatImage>>) -> Self {
        self.chat_images = images;
        self
    }

    /// Attach the open chat's reasoning level. Routing health checks that
    /// build a `RoutingModel` without this send no reasoning fields.
    pub fn with_user_reasoning(
        mut self,
        slot: crate::reasoning_levels::ReasoningLevelSlot,
        notice_tx: std::sync::mpsc::Sender<crate::reasoning_levels::ReasoningLevelNotice>,
        notices_seen: std::sync::Arc<std::sync::Mutex<std::collections::HashSet<String>>>,
    ) -> Self {
        self.reasoning_slot = Some(slot);
        self.reasoning_notice_tx = Some(notice_tx);
        self.reasoning_notices_seen = Some(notices_seen);
        self
    }

    /// Persona / profile for every attempt. Catalog `ProviderModel`
    /// already takes this on the stream request; free-tier must too.
    pub fn with_system_prompt(mut self, system_prompt: Option<String>) -> Self {
        self.system_prompt = system_prompt;
        self
    }

    #[cfg(test)]
    pub fn system_prompt(&self) -> Option<&str> {
        self.system_prompt.as_deref()
    }

    /// Reports each provider attempt, for the Chat activity line (step
    /// 4c). Without an observer, routing is unchanged.
    pub fn with_observer(mut self, observer: impl FnMut(ProviderAttempt) + Send + 'static) -> Self {
        self.observer = Some(Box::new(observer));
        self
    }

    /// Opt-in providers and strict mode. The default routes the default-on
    /// providers in the default mode.
    pub fn with_options(mut self, options: RoutingOptions) -> Self {
        self.options = options;
        self
    }

    #[cfg(test)]
    fn with_budget(mut self, budget: Millis) -> Self {
        self.budget = budget;
        self
    }

    #[cfg(test)]
    fn with_send_anyway(mut self, send_anyway: bool) -> Self {
        self.send_anyway = send_anyway;
        self
    }
}

impl<K: KeyStore, C: Clock> Model for RoutingModel<K, C> {
    fn set_chat_images(&mut self, images: Vec<Vec<crate::chat_images::ChatImage>>) {
        self.chat_images = images;
        if let Some((session, send_anyway)) = crate::chat_images::armed_image_turn() {
            self.image_session_id = Some(session);
            self.send_anyway = send_anyway;
        }
    }

    fn complete(&mut self, view: &ModelView, emit: &mut dyn FnMut(ModelEvent) -> bool) -> bool {
        let Self {
            catalog,
            options,
            keys,
            clock,
            health,
            budget,
            limits,
            inner,
            observer,
            system_prompt,
            reasoning_slot,
            reasoning_notice_tx,
            reasoning_notices_seen,
            chat_images,
            send_anyway,
            image_session_id,
        } = self;
        let mut report = |attempt: ProviderAttempt| {
            if let Some(observer) = observer.as_mut() {
                observer(attempt);
            }
        };
        let started = clock.now_ms();
        let mut tried = 0;
        let mut keyed = false;
        let mut skipped_vision = false;
        let mut reopens_at: Option<Millis> = None;
        let mut last_error: Option<ModelError> = None;
        let mut keychain_error: Option<String> = None;

        for target in catalog.targets(options) {
            let provider = &catalog.providers[target.provider];
            let (credential, base_url) = match reach(provider, keys) {
                Reach::Ready(credential, base_url) => (credential, base_url),
                Reach::Missing => continue,
                Reach::Unreadable(error) => {
                    if keychain_error.is_none() {
                        keychain_error = Some(error);
                    }
                    continue;
                }
            };
            keyed = true;
            let attempt = Attempt {
                provider: &provider.id,
                model: &target.model,
                family: &target.family,
                per_model_quota: provider.per_model_quota,
                key: fingerprint(credential.as_ref()),
            };
            let now = clock.now_ms();
            // The first try and one failover always run (freellmapi checklist).
            // The user's own endpoint is last and always runs, so slow free
            // providers cannot use up its turn.
            if tried >= 2 && now.saturating_sub(started) >= *budget && !provider.user_supplied {
                continue;
            }

            let provider_id = provider.id.clone();
            let model_id = target.model.clone();
            let mut request =
                provider_request(provider, &target.model, base_url.clone(), credential);
            let current_images = chat_images.last().is_some_and(|turn| !turn.is_empty());
            let can_see = match request.vision_state {
                crate::chat_images::VisionState::Yes => true,
                crate::chat_images::VisionState::Unknown => *send_anyway,
                crate::chat_images::VisionState::No => false,
            };
            if current_images && !can_see {
                skipped_vision = true;
                continue;
            }
            if let Some(until) = health.blocked_until(&attempt, now) {
                reopens_at = Some(reopens_at.map_or(until, |earliest| earliest.min(until)));
                continue;
            }
            if *send_anyway && request.vision_state == crate::chat_images::VisionState::Unknown {
                request.vision_state = crate::chat_images::VisionState::Yes;
                request.send_anyway = true;
            }
            request.image_session_id = image_session_id.clone();
            request.chat_images = chat_images.clone();
            tried += 1;
            report(ProviderAttempt::Trying {
                provider_id: provider_id.clone(),
                model_id: model_id.clone(),
            });
            request.system_prompt = system_prompt.clone();
            request.reasoning_slot = reasoning_slot.clone();
            request.reasoning_notice_tx = reasoning_notice_tx.clone();
            request.reasoning_notices_seen = reasoning_notices_seen.clone();
            let model = inner.get_or_insert_with(|| ProviderModel::new(request.clone(), *limits));
            model.retarget(request, provider.tool_params.clone());
            let mut on_first_output = || {
                report(ProviderAttempt::Answered {
                    provider_id: provider_id.clone(),
                    model_id: model_id.clone(),
                })
            };
            match run_attempt(model, view, emit, &mut on_first_output) {
                Outcome::Finished => {
                    health.record_success(&attempt);
                    return true;
                }
                Outcome::FailedAfterOutput(error) => {
                    health.record_failure(&attempt, &error, clock.now_ms());
                    report(ProviderAttempt::FailedAfterOutput {
                        provider_id,
                        model_id,
                        reason: error.kind,
                    });
                    return true;
                }
                Outcome::Stopped => return true,
                Outcome::FailedEarly(error) => {
                    health.record_failure(&attempt, &error, clock.now_ms());
                    report(ProviderAttempt::FailedOver {
                        provider_id,
                        model_id,
                        reason: error.kind.clone(),
                    });
                    last_error = Some(error);
                }
            }
        }

        let current_images = chat_images.last().is_some_and(|turn| !turn.is_empty());
        if current_images && tried == 0 && reopens_at.is_some() && last_error.is_none() {
            emit(ModelEvent::Error(crate::model_events::ModelError {
                kind: crate::model_events::ModelErrorKind::Rejected,
                status: None,
                message: "Every model that can read images is cooling down. Try again shortly."
                    .into(),
            }));
            return true;
        }
        if skipped_vision && tried == 0 && last_error.is_none() {
            emit(ModelEvent::Error(crate::model_events::ModelError {
                kind: crate::model_events::ModelErrorKind::Rejected,
                status: None,
                message: crate::chat_images::text_only_refusal("This model"),
            }));
            return true;
        }
        let error = exhausted(
            last_error,
            reopens_at,
            keyed,
            keychain_error.as_deref(),
            clock.now_ms(),
        );
        report(ProviderAttempt::Exhausted {
            reason: error.kind.clone(),
        });
        emit(ModelEvent::Error(error));
        true
    }
}

/// True when Free tier (auto) should stay in the picker (D11).
///
/// A target counts when its provider is on and it has the key (and account
/// id) it needs, or needs none. A keyless user endpoint counts. A locked or
/// denied keychain also counts: the key may be there, so the picker stays
/// and the send path reports the keychain error instead of "no key".
pub fn has_usable_target(
    catalog: &Catalog,
    options: &RoutingOptions,
    keys: &impl KeyStore,
) -> bool {
    let mut keychain_blocked = false;
    for target in catalog.targets(options) {
        match reach(&catalog.providers[target.provider], keys) {
            Reach::Ready(_, _) => return true,
            Reach::Unreadable(_) => keychain_blocked = true,
            Reach::Missing => {}
        }
    }
    keychain_blocked
}

/// Why one provider can or cannot be called. The router and
/// `has_usable_target` share this rule.
enum Reach {
    Ready(Option<Credential>, String),
    /// A required key is missing, or the URL needs an account id the
    /// credential lacks.
    Missing,
    /// The key store could not be read. The key may still be there.
    Unreadable(String),
}

fn reach(provider: &CatalogProvider, keys: &impl KeyStore) -> Reach {
    let lookup = match &provider.api_key {
        Some(api_key) => Ok(Some(Credential {
            api_key: api_key.clone(),
            account_id: None,
        })),
        None => keys.try_credential(provider.key_id.as_deref().unwrap_or(&provider.id)),
    };
    match lookup {
        Ok(credential) => {
            if provider.key_required && credential.is_none() {
                return Reach::Missing;
            }
            match resolve_base_url(&provider.base_url, credential.as_ref()) {
                Some(base_url) => Reach::Ready(credential, base_url),
                None => Reach::Missing,
            }
        }
        Err(error) if provider.key_required => Reach::Unreadable(error),
        // A key is optional. A locked keychain must not hide a provider
        // that can be called without one.
        Err(error) => match resolve_base_url(&provider.base_url, None) {
            Some(base_url) => Reach::Ready(None, base_url),
            None => Reach::Unreadable(error),
        },
    }
}

enum Outcome {
    /// The provider finished the step.
    Finished,
    /// The provider failed before any event reached the loop.
    FailedEarly(ModelError),
    /// The provider failed after the loop saw partial output.
    FailedAfterOutput(ModelError),
    /// The loop stopped reading.
    Stopped,
}

/// Holds back a first-event `Error` so the router can fail over. Every
/// other event goes to the loop at once. `on_first_output` runs once, when
/// the first event reaches the loop.
fn run_attempt(
    model: &mut ProviderModel,
    view: &ModelView,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
    on_first_output: &mut dyn FnMut(),
) -> Outcome {
    let mut started = false;
    let mut outcome = Outcome::Stopped;
    model.complete(view, &mut |event| {
        if !started {
            if let ModelEvent::Error(error) = event {
                outcome = Outcome::FailedEarly(error);
                return false;
            }
            started = true;
            on_first_output();
        }
        match &event {
            ModelEvent::Error(error) => outcome = Outcome::FailedAfterOutput(error.clone()),
            ModelEvent::Finish { .. } => outcome = Outcome::Finished,
            _ => {}
        }
        emit(event)
    });
    outcome
}

/// The terminal error when no target finished the step.
fn exhausted(
    last_error: Option<ModelError>,
    reopens_at: Option<Millis>,
    keyed: bool,
    keychain_error: Option<&str>,
    now: Millis,
) -> ModelError {
    let failure = |kind, message: &str| ModelError {
        kind,
        status: None,
        message: message.into(),
    };
    if let Some(error) = last_error {
        return ModelError {
            message: format!("Every free-tier provider failed. Last: {}", error.message),
            ..error
        };
    }
    if !keyed {
        if let Some(error) = keychain_error {
            return failure(ModelErrorKind::Auth, error);
        }
        return failure(ModelErrorKind::Auth, "No free-tier provider key is set.");
    }
    match reopens_at {
        Some(Millis::MAX) => failure(ModelErrorKind::Auth, "Every free-tier key was refused."),
        Some(until) => failure(
            ModelErrorKind::RateLimited {
                retry_after_secs: Some(until.saturating_sub(now).div_ceil(1_000)),
            },
            "Every free-tier provider is cooling down.",
        ),
        None => failure(
            ModelErrorKind::Rejected,
            "The free-tier catalog has no routable model.",
        ),
    }
}

/// Fills `{account_id}` from the credential. `None` when the URL needs an
/// account id and the credential has none.
fn resolve_base_url(template: &str, credential: Option<&Credential>) -> Option<String> {
    if !template.contains("{account_id}") {
        return Some(template.to_string());
    }
    let account_id = credential?.account_id.as_deref()?;
    Some(template.replace("{account_id}", account_id))
}

/// A fingerprint, so health can tell a new key from a refused one without
/// holding the key.
fn fingerprint(credential: Option<&Credential>) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    credential
        .map(|credential| &credential.api_key)
        .hash(&mut hasher);
    hasher.finish()
}

/// The provider request for one attempt. Built from JSON so optional fields
/// stay unset.
fn provider_request(
    provider: &CatalogProvider,
    model: &str,
    base_url: String,
    credential: Option<Credential>,
) -> AiModelStreamRequest {
    let vision: crate::chat_images::VisionState =
        crate::chat_images::vision_state(&provider.id, &base_url, model, false);
    let mut request: AiModelStreamRequest = serde_json::from_value(json!({
        "provider": {
            "id": provider.id,
            "name": provider.name,
            "kind": "open_ai_compatible",
            "base_url": base_url,
            "api_key_storage": "none",
            "headers": provider.headers,
            "models": [{
                "id": model,
                "capabilities": {
                    "streaming": true,
                    "tools": true,
                    "vision": vision == crate::chat_images::VisionState::Yes,
                    "json_mode": false,
                    "reasoning": crate::reasoning_levels::support_for_free_tier(&provider.id, &base_url, model)
                }
            }]
        },
        "model_id": model,
        "message": "",
        "api_key_override": credential.map(|credential| credential.api_key),
    }))
    .expect("a catalog provider request must deserialize");
    request.vision_state = vision;
    request
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_models::test_server::{http_response, serve, sse, TEST_LIMITS};
    use crate::model_events::FinishReason;
    use crate::rhizome_loop::{AgentLoop, DurableEvent};
    use base64::Engine;
    use serde_json::Value;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    const T0: Millis = 1_760_000_000_000;

    #[test]
    fn provider_request_uses_resolved_reasoning_instead_of_false() {
        let dir = tempfile::tempdir().expect("temp");
        crate::reasoning_levels::reset_reasoning_state_for_test(Some(dir.path().to_path_buf()));
        let nvidia: CatalogProvider = serde_json::from_value(json!({
            "id": "nvidia",
            "name": "NVIDIA NIM",
            "base_url": "https://integrate.api.nvidia.com/v1",
            "models": []
        }))
        .expect("provider");
        let nemotron = provider_request(
            &nvidia,
            "nvidia/nemotron-3-super-120b-a12b",
            nvidia.base_url.clone(),
            None,
        );
        assert!(matches!(
            nemotron.provider.models[0].capabilities.reasoning,
            crate::reasoning_levels::ReasoningSupport::Levels(_)
        ));
        let unknown = provider_request(&nvidia, "not-a-real-model", nvidia.base_url.clone(), None);
        assert_eq!(
            unknown.provider.models[0].capabilities.reasoning,
            crate::reasoning_levels::ReasoningSupport::Unknown
        );
        let _keep_off_the_user_cache = tempfile::tempdir().expect("temp");
        crate::reasoning_levels::reset_reasoning_state_for_test(Some(
            _keep_off_the_user_cache.path().to_path_buf(),
        ));
    }

    #[test]
    fn images_skip_a_text_model_and_reach_a_vision_model() {
        let dir = tempfile::tempdir().expect("temp");
        std::fs::write(
            dir.path().join("models-dev.json"),
            r#"{
              "openai": {"models": {"openai-model": {"modalities": {"input": ["text"]}}}},
              "google": {"models": {"google-model": {"modalities": {"input": ["text", "image"]}}}}
            }"#,
        )
        .unwrap();
        std::fs::write(dir.path().join("openrouter-models.json"), r#"{"data":[]}"#).unwrap();
        crate::reasoning_levels::reset_reasoning_state_for_test(Some(dir.path().to_path_buf()));

        let text = serve(vec![reply("nope")]);
        let vision = serve(vec![reply("seen")]);
        let mut router = RoutingModel::new(
            catalog(&[("openai", &text.base_url), ("google", &vision.base_url)]),
            keys(&["openai", "google"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );
        let image = crate::chat_images::ChatImage {
            mime_type: "image/png".into(),
            data: base64::engine::general_purpose::STANDARD.encode(b"png"),
        };
        router = router.with_chat_images(vec![vec![image]]);
        assert_eq!(run(&mut router), done("seen"));
        assert!(text.requests.lock().unwrap().is_empty());
        let body: Value = serde_json::from_str(&vision.requests.lock().unwrap()[0].1).unwrap();
        assert_eq!(body["messages"][0]["content"][1]["type"], "image_url");

        let _restore = tempfile::tempdir().expect("temp");
        crate::reasoning_levels::reset_reasoning_state_for_test(Some(
            _restore.path().to_path_buf(),
        ));
    }

    #[test]
    fn images_are_refused_when_no_routed_model_accepts_them() {
        let dir = tempfile::tempdir().expect("temp");
        std::fs::write(
            dir.path().join("models-dev.json"),
            r#"{"openai": {"models": {"openai-model": {"modalities": {"input": ["text"]}}}}}"#,
        )
        .unwrap();
        std::fs::write(dir.path().join("openrouter-models.json"), r#"{"data":[]}"#).unwrap();
        crate::reasoning_levels::reset_reasoning_state_for_test(Some(dir.path().to_path_buf()));

        let text = serve(vec![reply("nope")]);
        let mut router = RoutingModel::new(
            catalog(&[("openai", &text.base_url)]),
            keys(&["openai"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );
        router = router.with_chat_images(vec![vec![crate::chat_images::ChatImage {
            mime_type: "image/jpeg".into(),
            data: base64::engine::general_purpose::STANDARD.encode(b"jpg"),
        }]]);
        let events = run(&mut router);
        match events.last() {
            Some(ModelEvent::Error(error)) => {
                assert!(error.message.contains("can't read images"));
            }
            other => panic!("expected a vision refusal, got {other:?}"),
        }
        assert!(text.requests.lock().unwrap().is_empty());
        let _restore = tempfile::tempdir().expect("temp");
        crate::reasoning_levels::reset_reasoning_state_for_test(Some(
            _restore.path().to_path_buf(),
        ));
    }

    #[test]
    fn send_anyway_delivers_an_image_to_an_unknown_route() {
        let dir = tempfile::tempdir().expect("temp");
        std::fs::write(
            dir.path().join("models-dev.json"),
            r#"{"openai":{"models":{}}}"#,
        )
        .unwrap();
        std::fs::write(dir.path().join("openrouter-models.json"), r#"{"data":[]}"#).unwrap();
        crate::reasoning_levels::reset_reasoning_state_for_test(Some(dir.path().to_path_buf()));
        let unknown = serve(vec![reply("seen")]);
        let mut router = RoutingModel::new(
            catalog(&[("openai", &unknown.base_url)]),
            keys(&["openai"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        )
        .with_send_anyway(true)
        .with_chat_images(vec![vec![crate::chat_images::ChatImage {
            mime_type: "image/png".into(),
            data: base64::engine::general_purpose::STANDARD.encode(b"png"),
        }]]);
        assert_eq!(run(&mut router), done("seen"));
        let body: Value = serde_json::from_str(&unknown.requests.lock().unwrap()[0].1).unwrap();
        assert_eq!(body["messages"][0]["content"][1]["type"], "image_url");
        let _restore = tempfile::tempdir().expect("temp");
        crate::reasoning_levels::reset_reasoning_state_for_test(Some(
            _restore.path().to_path_buf(),
        ));
    }

    #[test]
    fn a_routing_probe_sends_no_reasoning_params() {
        let server = serve(vec![reply("ok")]);
        let mut router = RoutingModel::new(
            catalog(&[("groq", &server.base_url)]),
            keys(&["groq"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );
        assert_eq!(run(&mut router), done("ok"));
        let body = server.requests.lock().unwrap()[0].1.clone();
        let body: Value = serde_json::from_str(&body).unwrap();
        for key in [
            "reasoning_effort",
            "reasoning",
            "thinking",
            "chat_template_kwargs",
        ] {
            assert!(body.get(key).is_none(), "{key} was sent: {body}");
        }
    }

    struct FakeKeys(HashMap<String, Credential>);

    impl KeyStore for FakeKeys {
        fn credential(&self, provider_id: &str) -> Option<Credential> {
            self.0.get(provider_id).cloned()
        }
    }

    fn keys(ids: &[&str]) -> FakeKeys {
        FakeKeys(
            ids.iter()
                .map(|id| {
                    let credential = Credential {
                        api_key: format!("test-{id}"),
                        account_id: None,
                    };
                    (id.to_string(), credential)
                })
                .collect(),
        )
    }

    #[derive(Clone)]
    struct FakeClock(Arc<AtomicU64>);

    impl FakeClock {
        fn at(now: Millis) -> Self {
            Self(Arc::new(AtomicU64::new(now)))
        }

        fn advance(&self, by: Millis) {
            self.0.fetch_add(by, Ordering::SeqCst);
        }
    }

    impl Clock for FakeClock {
        fn now_ms(&self) -> Millis {
            self.0.load(Ordering::SeqCst)
        }
    }

    /// A catalog of `(id, base_url)` providers, one free model each.
    fn catalog(providers: &[(&str, &str)]) -> Catalog {
        let providers: Vec<Value> = providers
            .iter()
            .map(|(id, base_url)| {
                json!({
                    "id": id,
                    "name": id,
                    "base_url": base_url,
                    "evidence": "test",
                    "models": [{ "id": format!("{id}-model"), "free_type": "recurring-daily", "tos": "ok" }]
                })
            })
            .collect();
        serde_json::from_value(json!({
            "source": { "commit": "test", "curated_at": "test" },
            "providers": providers
        }))
        .unwrap()
    }

    fn view() -> ModelView {
        ModelView {
            admitted: "hi".into(),
            history: vec![],
            turn_start: 0,
            offered_tools: vec![],
        }
    }

    fn reply(text: &str) -> String {
        sse(&[
            &format!(
                r#"{{"choices":[{{"delta":{{"content":"{text}"}},"finish_reason":"stop"}}]}}"#
            ),
            "[DONE]",
        ])
    }

    fn run(model: &mut impl Model) -> Vec<ModelEvent> {
        let mut events = Vec::new();
        model.complete(&view(), &mut |event| {
            events.push(event);
            true
        });
        events
    }

    fn done(text: &str) -> Vec<ModelEvent> {
        vec![
            ModelEvent::TextDelta { text: text.into() },
            ModelEvent::Finish {
                reason: FinishReason::Stop,
            },
        ]
    }

    fn error_kind(events: &[ModelEvent]) -> Option<ModelErrorKind> {
        match events.last() {
            Some(ModelEvent::Error(error)) => Some(error.kind.clone()),
            _ => None,
        }
    }

    #[test]
    fn cooling_vision_routes_refuse_instead_of_sending_a_text_model() {
        let dir = tempfile::tempdir().expect("temp");
        std::fs::write(
            dir.path().join("models-dev.json"),
            r#"{
              "google": {"models": {"google-model": {"modalities": {"input": ["text", "image"]}}}},
              "openai": {"models": {"openai-model": {"modalities": {"input": ["text"]}}}}
            }"#,
        )
        .unwrap();
        std::fs::write(dir.path().join("openrouter-models.json"), r#"{"data":[]}"#).unwrap();
        crate::reasoning_levels::reset_reasoning_state_for_test(Some(dir.path().to_path_buf()));
        let vision = serve(vec![http_response(
            "429 Too Many Requests",
            &["Retry-After: 30"],
            "slow down",
        )]);
        let text = serve(vec![reply("half")]);
        let mut router = RoutingModel::new(
            catalog(&[("google", &vision.base_url), ("openai", &text.base_url)]),
            keys(&["google", "openai"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );
        assert_eq!(run(&mut router), done("half"));
        router = router.with_chat_images(vec![vec![crate::chat_images::ChatImage {
            mime_type: "image/png".into(),
            data: base64::engine::general_purpose::STANDARD.encode(b"png"),
        }]]);
        let events = run(&mut router);
        match events.last() {
            Some(ModelEvent::Error(error)) => {
                assert!(error.message.contains("cooling down"), "{}", error.message);
            }
            other => panic!("expected a cooling refusal, got {other:?}"),
        }
        assert_eq!(text.requests.lock().unwrap().len(), 1);
        let _restore = tempfile::tempdir().expect("temp");
        crate::reasoning_levels::reset_reasoning_state_for_test(Some(
            _restore.path().to_path_buf(),
        ));
    }

    #[test]
    fn a_429_fails_over_and_the_next_step_skips_the_cooling_provider() {
        let first = serve(vec![http_response(
            "429 Too Many Requests",
            &["Retry-After: 30"],
            "slow down",
        )]);
        let second = serve(vec![reply("one"), reply("two")]);
        let clock = FakeClock::at(T0);
        let mut router = RoutingModel::new(
            catalog(&[("a", &first.base_url), ("b", &second.base_url)]),
            keys(&["a", "b"]),
            clock.clone(),
            TEST_LIMITS,
        );

        assert_eq!(run(&mut router), done("one"));
        clock.advance(10_000);
        assert_eq!(run(&mut router), done("two"));

        assert_eq!(first.requests.lock().unwrap().len(), 1);
        let sent = &second.requests.lock().unwrap()[0].1;
        let body: Value = serde_json::from_str(sent).unwrap();
        assert_eq!(body["model"], "b-model");
    }

    #[test]
    fn a_system_prompt_is_prepended_to_the_first_request() {
        let server = serve(vec![reply("ok")]);
        let mut router = RoutingModel::new(
            catalog(&[("a", &server.base_url)]),
            keys(&["a"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        )
        .with_system_prompt(Some("Be brief.".into()));
        assert_eq!(run(&mut router), done("ok"));
        let sent = &server.requests.lock().unwrap()[0].1;
        let body: Value = serde_json::from_str(sent).unwrap();
        assert_eq!(body["messages"][0]["role"], "system");
        assert_eq!(body["messages"][0]["content"], "Be brief.");
    }

    #[test]
    fn usable_needs_a_key_for_a_key_required_provider() {
        let catalog = catalog(&[("a", "http://a.test/v1"), ("b", "http://b.test/v1")]);
        let options = RoutingOptions::default();

        assert!(!has_usable_target(&catalog, &options, &keys(&[])));
        assert!(has_usable_target(&catalog, &options, &keys(&["b"])));
    }

    #[test]
    fn a_provider_the_user_turned_off_is_not_usable() {
        let catalog = catalog(&[("a", "http://a.test/v1")]);
        let options = RoutingOptions {
            disabled: ["a".to_string()].into(),
            ..Default::default()
        };

        assert!(!has_usable_target(&catalog, &options, &keys(&["a"])));
    }

    #[test]
    fn a_keyless_user_endpoint_is_usable() {
        let catalog = catalog(&[("a", "http://a.test/v1")]).with_user_endpoint(UserEndpoint {
            base_url: "http://192.168.1.50:8080/v1".into(),
            model: "local".into(),
            ..Default::default()
        });

        assert!(has_usable_target(
            &catalog,
            &RoutingOptions::default(),
            &keys(&[])
        ));
    }

    #[test]
    fn an_own_endpoint_reads_the_key_saved_under_its_own_provider_id() {
        let catalog = catalog(&[]).with_user_endpoint(UserEndpoint {
            base_url: "https://hosted.test/v1".into(),
            model: "m".into(),
            name: "Hosted".into(),
            key_id: Some("open_ai_compatible-abc".into()),
            ..Default::default()
        });
        let endpoint = catalog.providers.last().unwrap();

        let Reach::Ready(credential, _) = reach(endpoint, &keys(&["open_ai_compatible-abc"]))
        else {
            panic!("expected the saved key");
        };

        assert_eq!(credential.unwrap().api_key, "test-open_ai_compatible-abc");
        assert_eq!(endpoint.name, "Hosted");
    }

    #[test]
    fn an_account_url_needs_the_account_id() {
        let catalog = catalog(&[("cf", "http://cf.test/{account_id}/v1")]);
        let key_only = keys(&["cf"]);
        let with_account = FakeKeys(
            [(
                "cf".to_string(),
                Credential {
                    api_key: "k".into(),
                    account_id: Some("acct".into()),
                },
            )]
            .into(),
        );

        assert!(!has_usable_target(
            &catalog,
            &RoutingOptions::default(),
            &key_only
        ));
        assert!(has_usable_target(
            &catalog,
            &RoutingOptions::default(),
            &with_account
        ));
    }

    struct LockedStore;

    impl KeyStore for LockedStore {
        fn credential(&self, _: &str) -> Option<Credential> {
            None
        }

        fn try_credential(&self, provider_id: &str) -> Result<Option<Credential>, String> {
            Err(format!(
                "The keychain could not be read for {provider_id}. It may be locked, or access was denied."
            ))
        }
    }

    fn error_message(events: &[ModelEvent]) -> String {
        match events.last() {
            Some(ModelEvent::Error(error)) => error.message.clone(),
            other => panic!("expected an error, got {other:?}"),
        }
    }

    #[test]
    fn a_locked_keychain_stays_in_the_picker_and_names_the_keychain() {
        let catalog = catalog(&[("a", "http://127.0.0.1:9")]);
        let options = RoutingOptions::default();
        assert!(has_usable_target(&catalog, &options, &LockedStore));

        let mut router = RoutingModel::new(catalog, LockedStore, FakeClock::at(T0), TEST_LIMITS);
        let message = error_message(&run(&mut router));

        assert!(message.contains("keychain"), "{message}");
        assert!(
            message.contains("locked") || message.contains("denied"),
            "{message}"
        );
        assert!(!message.contains("No free-tier provider key"), "{message}");
    }

    #[test]
    fn a_locked_keychain_still_calls_a_keyless_endpoint() {
        let server = serve(vec![reply("local")]);
        let catalog = catalog(&[]).with_user_endpoint(UserEndpoint {
            base_url: server.base_url.clone(),
            model: "local".into(),
            ..Default::default()
        });
        assert!(has_usable_target(
            &catalog,
            &RoutingOptions::default(),
            &LockedStore
        ));
        let mut router = RoutingModel::new(catalog, LockedStore, FakeClock::at(T0), TEST_LIMITS);
        assert_eq!(run(&mut router), done("local"));
    }

    #[test]
    fn a_missing_key_still_says_no_key_is_set() {
        let mut router = RoutingModel::new(
            catalog(&[("a", "http://127.0.0.1:9")]),
            keys(&[]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );
        let message = error_message(&run(&mut router));
        assert!(
            message.contains("No free-tier provider key is set."),
            "{message}"
        );
    }

    #[test]
    fn a_provider_without_a_key_is_never_called() {
        let first = serve(vec![]);
        let second = serve(vec![reply("ok")]);
        let mut router = RoutingModel::new(
            catalog(&[("a", &first.base_url), ("b", &second.base_url)]),
            keys(&["b"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );

        assert_eq!(run(&mut router), done("ok"));
        assert!(first.requests.lock().unwrap().is_empty());
    }

    #[test]
    fn a_200_with_an_error_body_fails_over() {
        let first = serve(vec![http_response(
            "200 OK",
            &["Content-Type: application/json"],
            r#"{"error":{"message":"upstream overloaded"}}"#,
        )]);
        let second = serve(vec![reply("ok")]);
        let mut router = RoutingModel::new(
            catalog(&[("a", &first.base_url), ("b", &second.base_url)]),
            keys(&["a", "b"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );

        assert_eq!(run(&mut router), done("ok"));
    }

    #[test]
    fn an_error_after_partial_output_ends_the_step_without_failover() {
        let first = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"part"}}]}"#,
            r#"{"error":{"message":"boom"}}"#,
        ])]);
        let second = serve(vec![]);
        let mut router = RoutingModel::new(
            catalog(&[("a", &first.base_url), ("b", &second.base_url)]),
            keys(&["a", "b"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );

        let events = run(&mut router);

        assert_eq!(
            events[0],
            ModelEvent::TextDelta {
                text: "part".into()
            }
        );
        assert_eq!(error_kind(&events), Some(ModelErrorKind::Unavailable));
        assert!(second.requests.lock().unwrap().is_empty());
    }

    #[test]
    fn a_spent_budget_still_allows_one_failover() {
        let failing = || serve(vec![http_response("503 Service Unavailable", &[], "down")]);
        let (a, b, c) = (failing(), failing(), failing());
        let mut router = RoutingModel::new(
            catalog(&[("a", &a.base_url), ("b", &b.base_url), ("c", &c.base_url)]),
            keys(&["a", "b", "c"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        )
        .with_budget(0);

        let events = run(&mut router);

        assert_eq!(a.requests.lock().unwrap().len(), 1);
        assert_eq!(b.requests.lock().unwrap().len(), 1);
        assert!(c.requests.lock().unwrap().is_empty());
        assert_eq!(error_kind(&events), Some(ModelErrorKind::Unavailable));
        assert_eq!(RETRY_BUDGET, 45_000);
    }

    #[test]
    fn a_spent_budget_still_tries_the_own_endpoint() {
        let failing = || serve(vec![http_response("503 Service Unavailable", &[], "down")]);
        let (a, b, c) = (failing(), failing(), failing());
        let lan = serve(vec![reply("local")]);
        let catalog = catalog(&[("a", &a.base_url), ("b", &b.base_url), ("c", &c.base_url)])
            .with_user_endpoint(UserEndpoint {
                base_url: lan.base_url.clone(),
                model: "qwen".into(),
                ..Default::default()
            });
        let mut router = RoutingModel::new(
            catalog,
            keys(&["a", "b", "c"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        )
        .with_budget(0);

        assert_eq!(run(&mut router), done("local"));
        assert!(c.requests.lock().unwrap().is_empty());
    }

    #[test]
    fn an_own_endpoint_sends_its_env_key_and_custom_headers() {
        let lan = serve(vec![reply("hosted")]);
        let catalog = catalog(&[]).with_user_endpoint(UserEndpoint {
            base_url: lan.base_url.clone(),
            model: "m".into(),
            api_key: Some("env-secret".into()),
            key_required: true,
            headers: [("X-Org".to_string(), "acme".to_string())].into(),
            ..Default::default()
        });
        let mut router = RoutingModel::new(catalog, keys(&[]), FakeClock::at(T0), TEST_LIMITS);

        assert_eq!(run(&mut router), done("hosted"));
        let request = lan.headers.lock().unwrap()[0].clone();
        assert!(request.contains("bearer env-secret"), "{request}");
        assert!(request.contains("x-org: acme"), "{request}");
    }

    #[test]
    fn an_own_endpoint_that_needs_a_missing_key_is_not_usable() {
        let catalog = catalog(&[]).with_user_endpoint(UserEndpoint {
            base_url: "https://hosted.test/v1".into(),
            model: "m".into(),
            key_required: true,
            ..Default::default()
        });

        assert!(!has_usable_target(
            &catalog,
            &RoutingOptions::default(),
            &keys(&[])
        ));
    }

    #[test]
    fn when_everything_cools_the_error_says_when_to_retry() {
        let only = serve(vec![http_response(
            "429 Too Many Requests",
            &["Retry-After: 12"],
            "slow down",
        )]);
        let mut router = RoutingModel::new(
            catalog(&[("a", &only.base_url)]),
            keys(&["a"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );
        run(&mut router);

        let events = run(&mut router);

        assert_eq!(
            error_kind(&events),
            Some(ModelErrorKind::RateLimited {
                retry_after_secs: Some(12)
            })
        );
        assert_eq!(only.requests.lock().unwrap().len(), 1);
    }

    #[test]
    fn with_no_key_at_all_the_error_is_auth() {
        let mut router = RoutingModel::new(
            catalog(&[("a", "http://127.0.0.1:9/v1")]),
            keys(&[]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );

        assert_eq!(error_kind(&run(&mut router)), Some(ModelErrorKind::Auth));
    }

    #[test]
    fn the_account_id_fills_the_url_and_tool_params_go_out_with_tools() {
        let server = serve(vec![reply("ok")]);
        let template = server.base_url.replace("/v1", "/{account_id}/v1");
        let mut catalog = catalog(&[("cf", &template)]);
        catalog.providers[0]
            .tool_params
            .insert("parallel_tool_calls".into(), json!(false));
        let mut keys = keys(&["cf"]);
        keys.0.get_mut("cf").unwrap().account_id = Some("acct".into());
        let mut router = RoutingModel::new(catalog, keys, FakeClock::at(T0), TEST_LIMITS);
        let with_tools = ModelView {
            offered_tools: vec!["echo".into()],
            ..view()
        };

        router.complete(&with_tools, &mut |_| true);

        let requests = server.requests.lock().unwrap();
        assert_eq!(requests[0].0, "POST /acct/v1/chat/completions");
        let body: Value = serde_json::from_str(&requests[0].1).unwrap();
        assert_eq!(body["parallel_tool_calls"], json!(false));
    }

    #[test]
    fn a_keyless_user_endpoint_routes_after_the_catalog() {
        let first = serve(vec![http_response("404 Not Found", &[], "no model")]);
        let lan = serve(vec![reply("local")]);
        let catalog = catalog(&[("a", &first.base_url)]).with_user_endpoint(UserEndpoint {
            base_url: lan.base_url.clone(),
            model: "qwen".into(),
            ..Default::default()
        });
        let mut router = RoutingModel::new(catalog, keys(&["a"]), FakeClock::at(T0), TEST_LIMITS);

        assert_eq!(run(&mut router), done("local"));
    }

    #[test]
    fn the_loop_runs_a_turn_through_the_router() {
        let first = serve(vec![http_response("500 Internal Server Error", &[], "x")]);
        let second = serve(vec![reply("routed")]);
        let agent = AgentLoop::new();
        let mut router = RoutingModel::new(
            catalog(&[("a", &first.base_url), ("b", &second.base_url)]),
            keys(&["a", "b"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );

        agent.submit("hi");
        agent.run_until_idle(&mut router);

        assert_eq!(
            agent.events(),
            vec![
                DurableEvent::User { text: "hi".into() },
                DurableEvent::Assistant {
                    text: "routed".into()
                },
                DurableEvent::TurnEnd,
            ]
        );
    }

    #[test]
    fn a_stop_from_the_loop_ends_the_step_without_failover() {
        let first = serve(vec![reply("one")]);
        let second = serve(vec![]);
        let mut router = RoutingModel::new(
            catalog(&[("a", &first.base_url), ("b", &second.base_url)]),
            keys(&["a", "b"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );
        let mut seen = 0;

        router.complete(&view(), &mut |_| {
            seen += 1;
            false
        });

        assert_eq!(seen, 1);
        assert!(second.requests.lock().unwrap().is_empty());
    }

    #[test]
    fn the_pinned_catalog_routes_groq_first() {
        let catalog = Catalog::pinned();
        let first = &catalog.targets(&RoutingOptions::default())[0];

        assert_eq!(catalog.providers[first.provider].id, "groq");
        assert_eq!(first.model, "openai/gpt-oss-120b");
    }

    #[test]
    fn the_system_clock_reads_wall_time() {
        // 2026-01-01T00:00:00Z. Daily resets need wall time, not uptime.
        assert!(SystemClock.now_ms() > 1_767_225_600_000);
    }

    #[test]
    fn an_opt_in_provider_routes_only_after_the_user_turns_it_on() {
        let down = || serve(vec![http_response("503 Service Unavailable", &[], "down")]);
        let opt_in = serve(vec![reply("opted")]);
        let first = down();
        let mut catalog = catalog(&[("a", &first.base_url), ("cf", &opt_in.base_url)]);
        catalog.providers[1].default_on = false;
        let mut router = RoutingModel::new(
            catalog.clone(),
            keys(&["a", "cf"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        );

        assert_eq!(
            error_kind(&run(&mut router)),
            Some(ModelErrorKind::Unavailable)
        );
        assert!(opt_in.requests.lock().unwrap().is_empty());

        let first = down();
        catalog.providers[0].base_url = first.base_url.clone();
        let options = RoutingOptions {
            opt_in: ["cf".to_string()].into(),
            strict: false,
            ..Default::default()
        };
        let mut router =
            RoutingModel::new(catalog, keys(&["a", "cf"]), FakeClock::at(T0), TEST_LIMITS)
                .with_options(options);

        assert_eq!(run(&mut router), done("opted"));
    }

    #[test]
    fn strict_mode_skips_a_provider_without_a_hard_stop() {
        let soft = serve(vec![]);
        let hard = serve(vec![reply("hard")]);
        let mut catalog = catalog(&[("soft", &soft.base_url), ("hard", &hard.base_url)]);
        catalog.providers[1].models[0].hard_stop = true;
        let options = RoutingOptions {
            strict: true,
            ..RoutingOptions::default()
        };
        let mut router = RoutingModel::new(
            catalog,
            keys(&["soft", "hard"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        )
        .with_options(options);

        assert_eq!(run(&mut router), done("hard"));
        assert!(soft.requests.lock().unwrap().is_empty());
    }

    fn observed(
        router: RoutingModel<FakeKeys, FakeClock>,
    ) -> (
        RoutingModel<FakeKeys, FakeClock>,
        Arc<std::sync::Mutex<Vec<ProviderAttempt>>>,
    ) {
        let seen = Arc::new(std::sync::Mutex::new(Vec::new()));
        let log = Arc::clone(&seen);
        let router = router.with_observer(move |attempt| log.lock().unwrap().push(attempt));
        (router, seen)
    }

    fn trying(id: &str) -> ProviderAttempt {
        ProviderAttempt::Trying {
            provider_id: id.into(),
            model_id: format!("{id}-model"),
        }
    }

    fn answered(id: &str) -> ProviderAttempt {
        ProviderAttempt::Answered {
            provider_id: id.into(),
            model_id: format!("{id}-model"),
        }
    }

    #[test]
    fn observer_sees_failover_then_answer() {
        let first = serve(vec![http_response(
            "429 Too Many Requests",
            &["Retry-After: 30"],
            "slow down",
        )]);
        let second = serve(vec![reply("ok")]);
        let (mut router, seen) = observed(RoutingModel::new(
            catalog(&[("a", &first.base_url), ("b", &second.base_url)]),
            keys(&["a", "b"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        ));

        assert_eq!(run(&mut router), done("ok"));

        assert_eq!(
            *seen.lock().unwrap(),
            vec![
                trying("a"),
                ProviderAttempt::FailedOver {
                    provider_id: "a".into(),
                    model_id: "a-model".into(),
                    reason: ModelErrorKind::RateLimited {
                        retry_after_secs: Some(30)
                    },
                },
                trying("b"),
                answered("b"),
            ]
        );
    }

    #[test]
    fn observer_reason_has_no_response_body() {
        let first = serve(vec![http_response(
            "503 Service Unavailable",
            &[],
            "secret-upstream-detail",
        )]);
        let second = serve(vec![reply("ok")]);
        let (mut router, seen) = observed(RoutingModel::new(
            catalog(&[("a", &first.base_url), ("b", &second.base_url)]),
            keys(&["a", "b"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        ));

        run(&mut router);

        let seen = format!("{:?}", seen.lock().unwrap());
        assert!(seen.contains("FailedOver"), "{seen}");
        assert!(!seen.contains("secret-upstream-detail"), "{seen}");
    }

    #[test]
    fn observer_sees_a_failure_after_output_and_no_failover() {
        let first = serve(vec![sse(&[
            r#"{"choices":[{"delta":{"content":"part"}}]}"#,
            r#"{"error":{"message":"boom"}}"#,
        ])]);
        let second = serve(vec![]);
        let (mut router, seen) = observed(RoutingModel::new(
            catalog(&[("a", &first.base_url), ("b", &second.base_url)]),
            keys(&["a", "b"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        ));

        run(&mut router);

        assert_eq!(
            *seen.lock().unwrap(),
            vec![
                trying("a"),
                answered("a"),
                ProviderAttempt::FailedAfterOutput {
                    provider_id: "a".into(),
                    model_id: "a-model".into(),
                    reason: ModelErrorKind::Unavailable,
                },
            ]
        );
    }

    #[test]
    fn observer_sees_exhausted_and_no_attempt_for_a_keyless_provider() {
        let first = serve(vec![]);
        let second = serve(vec![http_response("503 Service Unavailable", &[], "down")]);
        let (mut router, seen) = observed(RoutingModel::new(
            catalog(&[("a", &first.base_url), ("b", &second.base_url)]),
            keys(&["b"]),
            FakeClock::at(T0),
            TEST_LIMITS,
        ));

        run(&mut router);

        assert_eq!(
            *seen.lock().unwrap(),
            vec![
                trying("b"),
                ProviderAttempt::FailedOver {
                    provider_id: "b".into(),
                    model_id: "b-model".into(),
                    reason: ModelErrorKind::Unavailable,
                },
                ProviderAttempt::Exhausted {
                    reason: ModelErrorKind::Unavailable,
                },
            ]
        );
    }
}
