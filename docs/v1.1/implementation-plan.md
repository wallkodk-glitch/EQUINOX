# EQUINOX v1.1 implementation plan

Goal: integrate documented provider acquisition and isolated local credentials, preserving audited Engine 1.0.1. The user's 35-section specification is authoritative; no scope expansion or additional approval gates.

Architecture: new live-data modules are isolated from the existing Dataset/Engine boundary. Credentials live in a separate localStorage namespace; typed observations/cache live in a separate IndexedDB database. No financial-state or snapshot migration unless verified integration requires it. Raw provider payloads are validated and projected to allowlisted fields; responses, request headers, account IDs and credential-bearing URLs are never persisted.

Constraints: App 1.1.0, Engine 1.0.1, MarketDataModel 1.1.0; no mathematical changes. Baseline extracted twice; immutable original retained outside work folder. No git remote supplied; deliver a new ZIP.

## Review focus
- Provider payload can echo secrets in arbitrary text or pagination URLs: never persist or display raw errors or unknown fields.
- Replacement/removal while a test is pending must not mark the replacement as connected.
- Cached observations must never silently change holdings or risk data.
- Nationalbank date-only data must not masquerade as verified intraday publication times.
- Missing corporate-action evidence must remain a hard gate, not a user checkbox.

## Tasks in requested order
1. Inspect baseline and run original tests; verify primary docs. Original 69/69 passed. Record unresolved evidence before implementing dependent paths.
2. Write and run credential isolation and transport security tests. Implement credential store, typed allowlisted errors and header auth transport. No raw error cause persisted.
3. Implement compact Settings → Market Data and password sheet; test focus/cancel/reload/key exclusion in Chromium if available.
4. Write parser tests with independent expected values, then implement Nationalbank, Massive and CoinGecko parsers/adapters. Validate malformed/partial/conflicting/future observations, entitlement, pagination and bounded rate/network behavior.
5. Use existing immutable calendar for close-ending crypto buckets; add explicit timestamp roles and fail closed for undocumented stock close / ADR gross-dividend / FX availability semantics.
6. Add typed IndexedDB cache/freshness. Keep current references separate from Engine inputs. Gate risk refresh until semantics established. Do not forge Dataset.fx.publishedAt.
7. Add provenance visibility, security tests and compatibility tests. Run lint/typecheck/full suite/reference/build/browser/offline, credential scan and frozen-file hashes.
8. Fresh reviewer under executing-plans skill; fix material findings, rerun necessary gates. Package source/tests/dist/docs/evidence/checksums with explicit BLOCKED status if any acceptance gate remains unresolved.

## Evidence ledger
- Baseline: sole application source is uploaded audited ZIP. Original tests: 69/69 PASS.
- Ruling: user's direct implementation mandate takes precedence over skill design-approval ceremony.
- Ruling: native inline execution; no remote git/repo creation. Final independent reviewer only.
- Risk integration pending: Nationalbank historical availability, Massive TSM ADR cash basis, exact daily-stock close boundary, actual authenticated browser CORS and entitlements.
- October 5: reference cache/settings and hardened transport/SW implemented; one fresh review found two date/status edge cases, fixed with observed RED→GREEN. No mathematical changes.
- October 6: resume found workspace at earlier checkpoint. Reconstructed the reviewed cache/settings/hardening/tests from conversation; fresh commands, not earlier 99/99 output, certify the packaged source.
- Ruling: independent credential/reference work is completed while uncertain risk bridge remains absent and explicitly BLOCKED. Cost: this is a partial handoff, not accepted automatic integration.
- Ruling: ZIP-based delivery, no git remote/merge/publish/backend or deployment claim. Costs and reviewer coverage gaps are recorded in review.md.
