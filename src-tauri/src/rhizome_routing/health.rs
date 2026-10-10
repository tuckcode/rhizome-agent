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

pub(crate) type Millis = u64;

/// Upstream API-key breaker profile.
const DEGRADED_AT: u32 = 7;
const OPEN_AT: u32 = 12;
const HALF_OPEN_AFTER: Millis = 30_000;
/// Upstream API-key connection cooldown base.
const KEY_COOLDOWN_BASE: Millis = 3_000;
/// Upstream model-lockout cap. Rhizome uses it for key cooldowns too.
const COOLDOWN_CAP: Millis = 1_800_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BreakerState {
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
pub(crate) struct Attempt<'a> {
    pub(crate) provider: &'a str,
    pub(crate) model: &'a str,
    pub(crate) family: &'a str,
    pub(crate) per_model_quota: bool,
    /// A fingerprint of the key. A new key clears a dead-key mark.
    pub(crate) key: u64,
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

#[derive(Debug, Default)]
pub(crate) struct Health {
    breakers: HashMap<String, Breaker>,
    keys: HashMap<String, KeyState>,
}

impl Health {
    pub(crate) fn breaker_state(&self, provider: &str, now: Millis) -> BreakerState {
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
    pub(crate) fn blocked_until(&self, attempt: &Attempt, now: Millis) -> Option<Millis> {
        let breaker = self
            .breakers
            .get(attempt.provider)
            .and_then(|breaker| breaker.open_until);
        let key = self.keys.get(attempt.provider).map(|key| {
            if key.dead == Some(attempt.key) {
                Millis::MAX
            } else {
                key.cooldown_until
            }
        });
        [breaker, key]
            .into_iter()
            .flatten()
            .filter(|until| *until > now)
            .max()
    }

    pub(crate) fn record_success(&mut self, attempt: &Attempt) {
        self.breakers.remove(attempt.provider);
        self.keys.remove(attempt.provider);
    }

    pub(crate) fn record_failure(&mut self, attempt: &Attempt, error: &ModelError, now: Millis) {
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
        match (&error.kind, error.status) {
            (ModelErrorKind::RateLimited { retry_after_secs }, _) => {
                self.cool_key(attempt.provider, *retry_after_secs, now);
            }
            (ModelErrorKind::Auth, status) if status != Some(403) => {
                self.keys
                    .entry(attempt.provider.to_string())
                    .or_default()
                    .dead = Some(attempt.key);
            }
            _ => {}
        }
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
        assert_eq!(health.blocked_until(&groq, T0), Some(T0 + 30_000));
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
        assert_eq!(health.blocked_until(&groq, later), None);

        // A failed probe opens the breaker again for 30 s.
        health.record_failure(&groq, &unavailable(504), later);
        assert_eq!(health.blocked_until(&groq, later), Some(later + 30_000));

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
}
