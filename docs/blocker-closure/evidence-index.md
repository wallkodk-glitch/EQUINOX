# Evidence scopes

| File | Scope |
|---|---|
| `validation/release-checks.json` | Fresh lint/typecheck/Python/126-unit-test/build command output. The last browser step retains the actual launch-only EACCES result; it executed no app code and does not certify current runtime behavior. |
| `validation/closure-browser-suite-evidence.json` | Complete actual Chromium launch command/output, 15 blocked cases. |
| `validation/cors-probe.json`, `validation/probe-cors.log` | NOT TESTED conversion of actual launch failure and observed cloud local-origin rejection. No standalone provider probe ran in a browser. |
| `validation/closure-authenticated-massive.json` | Five actual authenticated plugin minute-bar rows with public fields only; CSV transport, native JSON envelope/direct app-key transport not exposed/tested. RecordedAt is evidence recording time, not invented per-row acquisition time. |
| `validation/closure-historical-fx-live.json` | Final actual Node execution of historical adapter after query fix; 252 official rates, null economic timestamps, actual acquisition time. |
| `validation/closure-node-provider-probes.json` | Earlier live adapter diagnostic: failed oversized history query, then successful current CG public quotes. Earlier failure is retained and superseded by the final historical probe, not concealed. |
| `validation/closure-tsm-issuer-comparison.json` | Exact six-event issuer/provider comparison and last live issuer page observation showing unresolved approximate latest ADR amount. |
| `validation/v1.1-audit.json` | Attached-1.1.0 comparison: 51 UI/public/kernel/reference/original-test files identical; complete changed/added list, no deletions, unchanged dependency versions. |
| `validation/closure-frozen-engine.json` | Separate audited-1.0.1 comparison: 15 kernel/data-contract/reference files identical. |
| `validation/reproducibility.json` | Lockfile equality and all 11 production hashes identical after separately fresh npm ci/build. |
| `validation/credential-scan.json` | Static structural source/dist/fixture/snapshot scan, zero findings; no real locally supplied API credential was available. Actual local-key browser exclusion remains NOT TESTED. |
| `validation/node-snapshot.json` | Synthetic Engine 1.0.1 fixture, unchanged original seal SHA-256 `e491090dd7e2cf8a81bd33c23d67460158aab62bac455d2f177de25038c50891`. |
| `tests/legacy-snapshot.json` | Original Engine 1.0.0 fixture with original hash/economic output preserved. |
| `validation/critical-audit.json`, `docs/v1.1/*`, older audit docs | Preserved historical audit/1.1.0 evidence, not newly executed browser or live-market acceptance. |

Calculation snapshots and fixture prices are not current portfolio valuations. No key, protected plugin credential, account ID, authorization value, private financial state or claimed historical publication clock is included. Runtime PWA/Safari/physical iPhone and complete real synchronized risk-window acceptance remain NOT TESTED/BLOCKED.
