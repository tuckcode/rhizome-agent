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
#[derive(Debug, Clone, PartialEq, Eq)]
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
        }
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
}

impl<K: KeyStore, C: Clock> Model for RoutingModel<K, C> {
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
            observer: _,
        } = self;
        let started = clock.now_ms();
        let mut tried = 0;
        let mut keyed = false;
        let mut reopens_at: Option<Millis> = None;
        let mut last_error: Option<ModelError> = None;

        for target in catalog.targets(options) {
            let provider = &catalog.providers[target.provider];
            let credential = keys.credential(&provider.id);
            if provider.key_required && credential.is_none() {
                continue;
            }
            let Some(base_url) = resolve_base_url(&provider.base_url, credential.as_ref()) else {
                continue;
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
            if let Some(until) = health.blocked_until(&attempt, now) {
                reopens_at = Some(reopens_at.map_or(until, |earliest| earliest.min(until)));
                continue;
            }
            // The first try and one failover always run (freellmapi checklist).
            if tried >= 2 && now.saturating_sub(started) >= *budget {
                break;
            }
            tried += 1;

            let request = provider_request(provider, &target.model, base_url, credential);
            let model = inner.get_or_insert_with(|| ProviderModel::new(request.clone(), *limits));
            model.retarget(request, provider.tool_params.clone());
            match run_attempt(model, view, emit) {
                Outcome::Finished => {
                    health.record_success(&attempt);
                    return true;
                }
                Outcome::FailedAfterOutput(error) => {
                    health.record_failure(&attempt, &error, clock.now_ms());
                    return true;
                }
                Outcome::Stopped => return true,
                Outcome::FailedEarly(error) => {
                    health.record_failure(&attempt, &error, clock.now_ms());
                    last_error = Some(error);
                }
            }
        }

        emit(ModelEvent::Error(exhausted(
            last_error,
            reopens_at,
            keyed,
            clock.now_ms(),
        )));
        true
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
/// other event goes to the loop at once.
fn run_attempt(
    model: &mut ProviderModel,
    view: &ModelView,
    emit: &mut dyn FnMut(ModelEvent) -> bool,
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
    serde_json::from_value(json!({
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
                    "vision": false,
                    "json_mode": false,
                    "reasoning": false
                }
            }]
        },
        "model_id": model,
        "message": "",
        "api_key_override": credential.map(|credential| credential.api_key),
    }))
    .expect("a catalog provider request must deserialize")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai_models::test_server::{http_response, serve, sse, TEST_LIMITS};
    use crate::model_events::FinishReason;
    use crate::rhizome_loop::{AgentLoop, DurableEvent};
    use serde_json::Value;
    use std::collections::HashMap;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    const T0: Millis = 1_760_000_000_000;

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
