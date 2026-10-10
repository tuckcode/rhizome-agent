//! Three cooldown layers for free-tier routing (ADR-0182).
//!
//! The rules follow OmniRoute's `docs/architecture/RESILIENCE_GUIDE.md` at the
//! catalog pin (MIT, Copyright (c) 2026 diegosouzapw). The code is Rhizome's.
//!
//! 1. Provider breaker: 408 and 5xx statuses only.
//! 2. Key cooldown: one key per provider.
//! 3. Model lockout: a quota family or one model.
//!
//! Times are milliseconds since the Unix epoch, from the caller's clock.

use std::collections::HashMap;

use crate::model_events::{ModelError, ModelErrorKind};

pub type Millis = u64;

/// Upstream API-key breaker profile.
const DEGRADED_AT: u32 = 7;
const OPEN_AT: u32 = 12;
const HALF_OPEN_AFTER: Millis = 30_000;
/// Upstream API-key connection cooldown base.
const KEY_COOLDOWN_BASE: Millis = 3_000;
/// Upstream model-lockout base and cap. Rhizome caps key cooldowns there too.
const LOCKOUT_BASE: Millis = 120_000;
const COOLDOWN_CAP: Millis = 1_800_000;
const DAY: Millis = 86_400_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreakerState {
    Closed,
    /// Traffic still goes through. Failures are elevated.
    Degraded,
    /// The router skips the provider.
    Open,
    /// The open time passed. The next request is a probe.
    HalfOpen,
}

#[derive(Debug, Default)]
struct Breaker {
    failures: u32,
    open_until: Option<Millis>,
}

/// One routing attempt, as the health layers see it.
#[derive(Debug, Clone, Copy)]
pub struct Attempt<'a> {
    pub provider: &'a str,
    pub model: &'a str,
    pub family: &'a str,
    pub per_model_quota: bool,
    /// A fingerprint of the key. A new key clears a dead-key mark.
    pub key: u64,
}

/// Layer 2 state for one provider's key.
#[derive(Debug, Default)]
struct KeyState {
    cooldown_until: Millis,
    /// Consecutive cooldowns without a success. The next one doubles.
    level: u32,
    /// The fingerprint of a key the provider refused (HTTP 401).
    dead: Option<u64>,
}

/// What a layer 3 lock covers. With one key per provider, upstream's
/// "exact" scope and its "bare model" scope are the same thing.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
enum LockScope {
    /// Every model that shares the quota.
    Family(String),
    Model(String),
}

#[derive(Debug, Default)]
struct Lock {
    until: Millis,
    level: u32,
}

#[derive(Debug, Default)]
pub struct Health {
    breakers: HashMap<String, Breaker>,
    keys: HashMap<String, KeyState>,
    locks: HashMap<(String, LockScope), Lock>,
}

impl Health {
    pub fn breaker_state(&self, provider: &str, now: Millis) -> BreakerState {
        let Some(breaker) = self.breakers.get(provider) else {
            return BreakerState::Closed;
        };
        match breaker.open_until {
            Some(until) if now < until => BreakerState::Open,
            Some(_) => BreakerState::HalfOpen,
            None if breaker.failures >= DEGRADED_AT => BreakerState::Degraded,
            None => BreakerState::Closed,
        }
    }

    /// When the attempt is blocked, the time it opens again. A refused key
    /// gives `Millis::MAX`.
    pub fn blocked_until(&self, attempt: &Attempt, now: Millis) -> Option<Millis> {
        let breaker = match self.breaker_state(attempt.provider, now) {
            BreakerState::Open => self
                .breakers
                .get(attempt.provider)
                .and_then(|breaker| breaker.open_until),
            _ => None,
        };
        let key = self.keys.get(attempt.provider).map(|key| {
            if key.dead == Some(attempt.key) {
                Millis::MAX
            } else {
                key.cooldown_until
            }
        });
        let lock = |scope: LockScope| {
            self.locks
                .get(&(attempt.provider.to_string(), scope))
                .map(|lock| lock.until)
        };
        let family = lock(LockScope::Family(attempt.family.to_string()));
        let model = lock(LockScope::Model(attempt.model.to_string()));
        [breaker, key, family, model]
            .into_iter()
            .flatten()
            .filter(|until| *until > now)
            .max()
    }

    pub fn record_success(&mut self, attempt: &Attempt) {
        self.breakers.remove(attempt.provider);
        self.keys.remove(attempt.provider);
        for scope in [
            LockScope::Family(attempt.family.to_string()),
            LockScope::Model(attempt.model.to_string()),
        ] {
            self.locks.remove(&(attempt.provider.to_string(), scope));
        }
    }

    pub fn record_failure(&mut self, attempt: &Attempt, error: &ModelError, now: Millis) {
        if trips_breaker(error) {
            let breaker = self
                .breakers
                .entry(attempt.provider.to_string())
                .or_default();
            breaker.failures += 1;
            if breaker.failures >= OPEN_AT {
                breaker.open_until = Some(now + HALF_OPEN_AFTER);
            }
        }
        let family = LockScope::Family(attempt.family.to_string());
        let model = LockScope::Model(attempt.model.to_string());
        match (&error.kind, error.status) {
            // freellmapi checklist: a daily quota stays benched until UTC
            // midnight.
            (ModelErrorKind::RateLimited { .. }, _) if is_daily_limit(error) => {
                self.lock_until(attempt.provider, family, next_utc_midnight(now));
            }
            (ModelErrorKind::RateLimited { retry_after_secs }, _) if attempt.per_model_quota => {
                self.lock(attempt.provider, family, *retry_after_secs, now);
            }
            (ModelErrorKind::RateLimited { retry_after_secs }, _) => {
                self.cool_key(attempt.provider, *retry_after_secs, now);
            }
            (ModelErrorKind::QuotaExhausted, _) => {
                self.lock_until(attempt.provider, family, next_utc_midnight(now));
            }
            // A 403 is an entitlement signal for the quota family.
            (ModelErrorKind::Auth, Some(403)) => self.lock(attempt.provider, family, None, now),
            (ModelErrorKind::Auth, _) => {
                self.keys
                    .entry(attempt.provider.to_string())
                    .or_default()
                    .dead = Some(attempt.key);
            }
            (ModelErrorKind::Rejected, Some(404))
            | (ModelErrorKind::Unavailable, _)
            | (ModelErrorKind::Protocol, _) => self.lock(attempt.provider, model, None, now),
            // Another 4xx is about this request, not the model's health.
            (ModelErrorKind::Rejected, _) => {}
        }
    }

    /// Upstream lockout: `Retry-After` when sent, else 120 s doubling to 30
    /// min.
    fn lock(
        &mut self,
        provider: &str,
        scope: LockScope,
        retry_after_secs: Option<u64>,
        now: Millis,
    ) {
        let lock = self.locks.entry((provider.to_string(), scope)).or_default();
        let wait = match retry_after_secs {
            Some(secs) => secs.saturating_mul(1_000),
            None => backoff(LOCKOUT_BASE, lock.level),
        };
        lock.level += 1;
        lock.until = lock.until.max(now.saturating_add(wait));
    }

    fn lock_until(&mut self, provider: &str, scope: LockScope, until: Millis) {
        let lock = self.locks.entry((provider.to_string(), scope)).or_default();
        lock.until = lock.until.max(until);
    }

    /// Upstream: honor `Retry-After`, else 3 s doubling per cooldown.
    fn cool_key(&mut self, provider: &str, retry_after_secs: Option<u64>, now: Millis) {
        let key = self.keys.entry(provider.to_string()).or_default();
        let wait = match retry_after_secs {
            Some(secs) => secs.saturating_mul(1_000),
            None => backoff(KEY_COOLDOWN_BASE, key.level),
        };
        key.level += 1;
        key.cooldown_until = key.cooldown_until.max(now.saturating_add(wait));
    }
}

fn next_utc_midnight(now: Millis) -> Millis {
    (now / DAY + 1) * DAY
}

/// A 429 whose text names a per-day limit, such as Groq's "tokens per day
/// (TPD)".
fn is_daily_limit(error: &ModelError) -> bool {
    let message = error.message.to_ascii_lowercase();
    ["per day", "per-day", "daily"]
        .iter()
        .any(|needle| message.contains(needle))
}

/// `base` doubled `level` times, capped at `COOLDOWN_CAP`.
fn backoff(base: Millis, level: u32) -> Millis {
    base.saturating_mul(1 << level.min(20)).min(COOLDOWN_CAP)
}

/// Upstream trip codes. A failure with no status is Rhizome's own timeout
/// or connect error, and it does not count.
fn trips_breaker(error: &ModelError) -> bool {
    error.kind == ModelErrorKind::Unavailable
        && matches!(error.status, Some(408 | 500 | 502 | 503 | 504))
}

#[cfg(test)]
mod tests {
    use super::*;

    const T0: Millis = 1_760_000_000_000;

    fn attempt(provider: &'static str) -> Attempt<'static> {
        Attempt {
            provider,
            model: "m",
            family: "m",
            per_model_quota: false,
            key: 1,
        }
    }

    /// Another model on the same provider. Only the breaker blocks it.
    fn sibling(attempt: Attempt<'static>) -> Attempt<'static> {
        Attempt {
            model: "other",
            family: "other",
            ..attempt
        }
    }

    fn error(kind: ModelErrorKind, status: Option<u16>) -> ModelError {
        ModelError {
            kind,
            status,
            message: String::new(),
        }
    }

    fn unavailable(status: u16) -> ModelError {
        error(ModelErrorKind::Unavailable, Some(status))
    }

    #[test]
    fn breaker_degrades_at_seven_and_opens_at_twelve() {
        let mut health = Health::default();
        let groq = attempt("groq");
        let mistral = attempt("mistral");

        for _ in 0..6 {
            health.record_failure(&groq, &unavailable(503), T0);
        }
        assert_eq!(health.breaker_state("groq", T0), BreakerState::Closed);
        health.record_failure(&groq, &unavailable(502), T0);
        assert_eq!(health.breaker_state("groq", T0), BreakerState::Degraded);
        for _ in 0..5 {
            health.record_failure(&groq, &unavailable(408), T0);
        }

        assert_eq!(health.breaker_state("groq", T0), BreakerState::Open);
        // Each 5xx also locks the failing model, so check a sibling.
        assert_eq!(health.blocked_until(&sibling(groq), T0), Some(T0 + 30_000));
        assert_eq!(health.blocked_until(&mistral, T0), None);
    }

    #[test]
    fn breaker_half_opens_after_thirty_seconds_and_a_probe_decides() {
        let mut health = Health::default();
        let groq = attempt("groq");
        for _ in 0..12 {
            health.record_failure(&groq, &unavailable(500), T0);
        }
        let later = T0 + 30_000;

        assert_eq!(health.breaker_state("groq", later), BreakerState::HalfOpen);
        assert_eq!(health.blocked_until(&sibling(groq), later), None);

        // A failed probe opens the breaker again for 30 s.
        health.record_failure(&groq, &unavailable(504), later);
        assert_eq!(
            health.blocked_until(&sibling(groq), later),
            Some(later + 30_000)
        );

        // A good probe closes it.
        health.record_success(&groq);
        assert_eq!(health.breaker_state("groq", later), BreakerState::Closed);
    }

    #[test]
    fn only_408_and_5xx_statuses_count_against_the_breaker() {
        let mut health = Health::default();
        let groq = attempt("groq");

        for _ in 0..20 {
            // Rhizome's own timeout or connect failure has no status.
            health.record_failure(&groq, &error(ModelErrorKind::Unavailable, None), T0);
            health.record_failure(
                &groq,
                &error(
                    ModelErrorKind::RateLimited {
                        retry_after_secs: None,
                    },
                    Some(429),
                ),
                T0,
            );
            health.record_failure(&groq, &error(ModelErrorKind::Auth, Some(403)), T0);
        }

        assert_eq!(health.breaker_state("groq", T0), BreakerState::Closed);
    }

    fn rate_limited(retry_after_secs: Option<u64>) -> ModelError {
        error(ModelErrorKind::RateLimited { retry_after_secs }, Some(429))
    }

    #[test]
    fn key_cooldown_honors_retry_after_and_spares_other_providers() {
        let mut health = Health::default();
        let mistral = attempt("mistral");

        health.record_failure(&mistral, &rate_limited(Some(7)), T0);

        assert_eq!(health.blocked_until(&mistral, T0), Some(T0 + 7_000));
        assert_eq!(health.blocked_until(&mistral, T0 + 7_000), None);
        assert_eq!(health.blocked_until(&attempt("llm7"), T0), None);
    }

    #[test]
    fn key_cooldown_starts_at_three_seconds_and_doubles_until_a_success() {
        let mut health = Health::default();
        let mistral = attempt("mistral");

        health.record_failure(&mistral, &rate_limited(None), T0);
        assert_eq!(health.blocked_until(&mistral, T0), Some(T0 + 3_000));
        health.record_failure(&mistral, &rate_limited(None), T0 + 3_000);
        assert_eq!(health.blocked_until(&mistral, T0 + 3_000), Some(T0 + 9_000));

        health.record_success(&mistral);
        health.record_failure(&mistral, &rate_limited(None), T0 + 9_000);
        assert_eq!(
            health.blocked_until(&mistral, T0 + 9_000),
            Some(T0 + 12_000)
        );
    }

    #[test]
    fn a_rejected_key_stays_skipped_until_the_key_changes() {
        let mut health = Health::default();
        let mistral = attempt("mistral");

        health.record_failure(&mistral, &error(ModelErrorKind::Auth, Some(401)), T0);

        assert_eq!(
            health.blocked_until(&mistral, T0 + 86_400_000),
            Some(Millis::MAX)
        );
        let new_key = Attempt { key: 2, ..mistral };
        assert_eq!(health.blocked_until(&new_key, T0), None);
    }

    fn model(
        provider: &'static str,
        model: &'static str,
        family: &'static str,
    ) -> Attempt<'static> {
        Attempt {
            provider,
            model,
            family,
            per_model_quota: true,
            key: 1,
        }
    }

    fn next_midnight(now: Millis) -> Millis {
        (now / DAY + 1) * DAY
    }

    #[test]
    fn a_per_model_quota_429_locks_the_family_and_not_the_key() {
        let mut health = Health::default();
        let lfm = model("openrouter", "lfm:free", "openrouter-free");
        let sibling = model("openrouter", "other:free", "openrouter-free");
        let elsewhere = model("openrouter", "solo:free", "solo:free");

        health.record_failure(&lfm, &rate_limited(Some(20)), T0);

        assert_eq!(health.blocked_until(&sibling, T0), Some(T0 + 20_000));
        assert_eq!(health.blocked_until(&elsewhere, T0), None);
    }

    #[test]
    fn exhausted_quota_and_a_daily_429_bench_the_family_until_utc_midnight() {
        let mut health = Health::default();
        let mistral = Attempt {
            per_model_quota: false,
            ..model("mistral", "mistral-small-latest", "mistral")
        };
        let groq = model("groq", "openai/gpt-oss-20b", "openai/gpt-oss-20b");
        let daily = ModelError {
            message: "Rate limit reached on tokens per day (TPD): Limit 200000".into(),
            ..rate_limited(Some(5))
        };

        health.record_failure(
            &mistral,
            &error(ModelErrorKind::QuotaExhausted, Some(402)),
            T0,
        );
        health.record_failure(&groq, &daily, T0);

        assert_eq!(health.blocked_until(&mistral, T0), Some(next_midnight(T0)));
        assert_eq!(health.blocked_until(&groq, T0), Some(next_midnight(T0)));
        assert_eq!(health.blocked_until(&groq, next_midnight(T0)), None);
    }

    #[test]
    fn a_404_locks_only_that_model_and_escalates_to_a_cap() {
        let mut health = Health::default();
        let gone = model("nvidia", "old/model", "nvidia");
        let sibling = model("nvidia", "new/model", "nvidia");
        let not_found = error(ModelErrorKind::Rejected, Some(404));

        health.record_failure(&gone, &not_found, T0);
        assert_eq!(health.blocked_until(&gone, T0), Some(T0 + 120_000));
        assert_eq!(health.blocked_until(&sibling, T0), None);

        health.record_failure(&gone, &not_found, T0);
        assert_eq!(health.blocked_until(&gone, T0), Some(T0 + 240_000));
        for _ in 0..10 {
            health.record_failure(&gone, &not_found, T0);
        }
        assert_eq!(health.blocked_until(&gone, T0), Some(T0 + 1_800_000));

        health.record_success(&gone);
        assert_eq!(health.blocked_until(&gone, T0), None);
    }

    #[test]
    fn a_403_locks_the_family_and_a_5xx_locks_the_exact_model() {
        let mut health = Health::default();
        let a = model("mistral", "a", "mistral");
        let b = model("mistral", "b", "mistral");
        let c = model("groq", "c", "c");
        let d = model("groq", "d", "d");

        health.record_failure(&a, &error(ModelErrorKind::Auth, Some(403)), T0);
        health.record_failure(&c, &unavailable(503), T0);
        health.record_failure(&c, &error(ModelErrorKind::Protocol, None), T0 + 1);

        assert_eq!(health.blocked_until(&b, T0), Some(T0 + 120_000));
        assert!(health.blocked_until(&c, T0 + 1).is_some());
        assert_eq!(health.blocked_until(&d, T0), None);
    }

    #[test]
    fn a_plain_400_locks_nothing() {
        let mut health = Health::default();
        let a = model("mistral", "a", "mistral");

        health.record_failure(&a, &error(ModelErrorKind::Rejected, Some(400)), T0);

        assert_eq!(health.blocked_until(&a, T0), None);
    }
}
