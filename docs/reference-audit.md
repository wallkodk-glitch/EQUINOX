# EQUINOX v1 independent numerical audit

The independent Python reference passes its assertions. `reference/reproduce.py` imports Python standard-library modules, NumPy, and SciPy only. It does not import, execute, or translate calls to production TypeScript functions. The supplied FX, covariance, and diagonal ERC expected values are correct at their quoted precision. The BUY-01 target requires explicit normalization because its rounded components do not sum exactly to one.

Run from the project directory:

```bash
python reference/reproduce.py --check
```

The command independently recalculates and checks the committed `reference/reference.json` without rewriting it. Omitting `--check` intentionally regenerates the golden file for a reviewed model change. The recorded environment is Python 3.12.14, NumPy 2.3.5, and SciPy 1.17.0. Dependency versions are pinned in `reference/requirements.txt`. Last-bit numerical differences across BLAS or SciPy builds are expected; the JSON records comparison tolerances.

Every five-element vector uses this order: **GOOGL, ISRG, TSM, BTC, ETH**. Weights and returns are fractions, not percentages. Monetary values are DKK. Covariances are annual unless explicitly labeled sample covariance.

## Conventions and equations

FX is expressed as DKK per USD. Convert each price before calculating returns:

\[
P^{DKK}_t=P^{USD}_t F_t,\qquad r_t=P^{DKK}_t/P^{DKK}_{t-1}-1.
\]

The covariance fixture uses arithmetic returns, column demeaning, sample denominator \(T-1\), and annualization factor 252:

\[
\Sigma=252\frac{(R-\bar R)^\top(R-\bar R)}{T-1}.
\]

For \(V=w^\top\Sigma w>0\), portfolio volatility is \(\sqrt V\), marginal volatility is \((\Sigma w)_i/\sqrt V\), and absolute volatility contribution is \(w_i(\Sigma w)_i/\sqrt V\). The canonical ERC objective uses dimensionless risk shares:

\[
RCShare_i=\frac{w_i(\Sigma w)_i}{V},\qquad
f(w)=\sum_{i=1}^{5}(RCShare_i-0.2)^2.
\]

Absolute volatility contributions sum to portfolio volatility. Risk shares sum to one. Multiplying the covariance matrix by a positive scalar does not change the ERC objective or optimizer weights.

## FX-01

| Series | Independent result |
|---|---|
| USD prices | `[100, 102, 101, 104]` |
| DKK per USD | `[6.8, 6.9, 6.85, 7]` |
| DKK prices | `[680, 703.8, 691.85, 728]` |
| DKK arithmetic returns | `[0.035, -0.016979255470304065, 0.0522512105225121]` |

The quoted returns `[0.035, -0.01697926, 0.05225121]` agree to eight decimal places. The maximum rounding difference is `4.5296959343e-9`. Decimal arithmetic at 40-digit precision independently verifies the currency conversion and returns; full-precision decimal return strings are included in the JSON. No fixture correction is needed.

## COV-01

The four return observations are:

```text
[[ 0.01,  0.02,  0.00],
 [-0.01,  0.01,  0.02],
 [ 0.02, -0.01,  0.01],
 [ 0.00,  0.00, -0.01]]
```

Each column mean is `0.005`. Explicit centered matrix multiplication agrees with NumPy's `cov(..., rowvar=False, ddof=1)`. The annual covariance is:

```text
[[ 0.0420, -0.0168, -0.0084],
 [-0.0168,  0.0420,  0.0000],
 [-0.0084,  0.0000,  0.0420]]
```

All three annual volatilities are `0.20493901531919195`. The eigenvalues are approximately `[0.023217028989001742, 0.042, 0.06078297101099822]`, so the fixture is positive definite. A computed entry of approximately `4.95e-19` is floating-point zero. No fixture correction is needed.

## ERC-01: diagonal covariance

The annual covariance is `diag([0.1², 0.2², 0.3², 0.4², 0.5²])`. Equal risk contributions imply \(w_i\propto1/\sigma_i\), giving the exact rational vector:

```text
[60/137, 30/137, 20/137, 15/137, 12/137]
```

| Asset | Exact-form reference as decimal | Risk share |
|---|---:|---:|
| GOOGL | 0.43795620437956206 | 0.2 |
| ISRG | 0.21897810218978103 | 0.2 |
| TSM | 0.14598540145985403 | 0.2 |
| BTC | 0.10948905109489052 | 0.2 |
| ETH | 0.08759124087591241 | 0.2 |

Portfolio volatility is `0.09792998441604919`; the theoretical objective is zero. Independently minimizing the canonical risk-share objective with SciPy SLSQP gives a maximum weight error of `4.69e-9` against the exact vector. The prompt's rounded weights need no correction.

## ERC-02: constrained, non-diagonal positive-definite covariance

This is an audit fixture with deliberately binding constraints. Its parameters are not application defaults.

```text
annual covariance =
[[0.040000, 0.014000, 0.028000, 0.006500, 0.008500],
 [0.014000, 0.078400, 0.029400, 0.018200, 0.023800],
 [0.028000, 0.029400, 0.122500, 0.034125, 0.044625],
 [0.006500, 0.018200, 0.034125, 0.422500, 0.359125],
 [0.008500, 0.023800, 0.044625, 0.359125, 0.722500]]

lower bounds = [0.05, 0.05, 0.05, 0.03, 0.03]
upper bounds = [0.32, 0.40, 0.40, 0.20, 0.20]
sum(weights) = 1
BTC + ETH <= 0.12
```

The smallest covariance eigenvalue is `0.030722644538305293`, and the largest is `0.9667427450058538`. Sixty-four deterministic SLSQP starts, including fixed starts and seeded Dirichlet starts, converge to the same objective within `5.3e-15`. Their maximum weight difference from the polished result is `2.50e-8`. SLSQP uses the analytic objective gradient, independently checked against central finite differences with maximum error `3.60e-11`.

After observing the active constraints, an independent two-variable root solve polishes stationarity on the face `GOOGL=0.32`, `ISRG+TSM=0.56`, `BTC+ETH=0.12`.

| Asset | Constrained weight | Risk share |
|---|---:|---:|
| GOOGL | 0.32000000000000000 | 0.18800709524572387 |
| ISRG | 0.32379895467731273 | 0.30127738539902390 |
| TSM | 0.23620104532268720 | 0.29148393100269550 |
| BTC | 0.05210732278740623 | 0.07687327813434953 |
| ETH | 0.06789267721259376 | 0.14235831021820720 |

The canonical objective is `0.03725300222769519`, and portfolio volatility is `0.20571271723203274`. Exact equal risk is prevented by the binding constraints; a nonzero objective here is expected.

The KKT convention is `g <= 0`, with `L = f + lambda*(sum(w)-1) + sum(mu*g)`:

| Active constraint | Multiplier |
|---|---:|
| `sum(w)-1 = 0` | -0.1888936217946086 |
| `w_GOOGL-0.32 <= 0` | 0.25103846183900946 |
| `w_BTC+w_ETH-0.12 <= 0` | 0.9046776167177117 |

Primal infinity-norm residual is `1.11e-16`, stationarity residual is `2.22e-16`, dual violation is zero, and complementarity residual is zero. All inequality multipliers have the correct sign. These are first-order certificates and strong multistart agreement. The canonical risk-share objective is nonlinear and generally nonconvex; this audit does not claim a global optimality proof.

## BUY-01: exact correction and allocation

The supplied target is:

```text
[0.26222622, 0.22582258, 0.20692069, 0.17811781, 0.12691269]
```

Its floating-point sum is `0.9999999899999998`. Normalize it by its own sum before constructing post-trade target values. The corrected normalized target is:

```text
[0.2622262226222623,
 0.22582258225822585,
 0.20692069206920694,
 0.17811781178117814,
 0.12691269126912694]
```

For current holdings `v=[2000,2000,3000,1800,1200]` and cash `C=2500`, the post-trade total is `12500`. The audited problem is:

\[
\min_{x\ge0,\ \sum x=C}\ \left\|\frac{v+x}{\sum v+C}-w^*\right\|_2^2.
\]

Let \(y=(\sum v+C)w^*-v\). The problem is equivalent to projecting \(y\) onto the nonnegative cash simplex. The unique solution is \(x_i=\max(y_i-\theta,0)\), where \(\theta\) makes the buys sum to the available cash. This is ordinary Euclidean projection, not proportional redistribution of positive deficits.

| Asset | Optimal buy, DKK | Post-trade weight | Buy rounded to øre |
|---|---:|---:|---:|
| GOOGL | 1174.4549454945502 | 0.25395639563956400 | 1174.45 |
| ISRG | 719.4094409440943 | 0.21755275527552753 | 719.41 |
| TSM | 0 | 0.24000000000000000 | 0.00 |
| BTC | 323.09980998099786 | 0.16984798479847982 | 323.10 |
| ETH | 283.0358035803579 | 0.11864286428642863 | 283.04 |

The squared weight error is `0.0013678007664752884`. TSM remains above target because sales are prohibited. The continuous allocation sums to `2500` within floating-point tolerance. The rounded allocation sums to exactly `2500.00` DKK using integer cents and the largest-remainder method with stable asset-order tie breaking.

The second formulation uses SciPy SLSQP on buy fractions, with the cash constraint and nonnegative bounds. SLSQP's active set is polished by solving the quadratic program's linear KKT system. This independently computed allocation differs from the analytic simplex solution by at most `2.28e-13` DKK. The unpolished SLSQP result differs by `1.25e-5` DKK; both raw and polished outputs are recorded instead of hiding solver stopping error.

These buy fixtures impose no sales, nonnegative buys, and full use of supplied cash. A target's allocation bounds do not by themselves guarantee that the buy-only post-trade portfolio can satisfy those bounds. Infeasible target weights must be represented as residual drift.

## Additional buy-only cases

Each case is checked using both formulations. The JSON includes complete inputs, outputs, KKT residuals, post-trade weights, and rounded allocations.

| Case | Current DKK values | Cash | Target | Optimal buys, DKK |
|---|---|---:|---|---|
| BUY-02 balanced | `[1000,1000,1000,1000,1000]` | 1000 | equal | `[200,200,200,200,200]` |
| BUY-03 heavy overweight | `[9000,250,250,250,250]` | 2500 | equal | `[0,625,625,625,625]` |
| BUY-04 zero cash | `[2000,2000,3000,1800,1200]` | 0 | equal | `[0,0,0,0,0]` |
| BUY-05 empty holdings | `[0,0,0,0,0]` | 1000 | normalized `[1,2,3,2,2]` | `[100,200,300,200,200]` |
| BUY-06 sparse target | `[100,0,0,0,0]` | 10 | `[1,0,0,0,0]` | `[10,0,0,0,0]` |
| BUY-07 two blocked buys | `[5000,3500,500,500,500]` | 500 | equal | `[0,0,166.6666667,166.6666667,166.6666667]` |
| BUY-08 three øre | `[2000,2000,3000,1800,1200]` | 0.03 | equal | `[0,0,0,0,0.03]` |

BUY-07 rounds deterministically to `[0,0,166.67,166.67,166.66]`. Explicit negative cash, negative holdings, negative targets, zero target sum, nonfinite targets, and zero total post-trade value are rejected. A zero-cash portfolio with positive existing value remains valid and returns zero buys.

## Singular covariance and numerical policy

Singularity alone does not make risk arithmetic or ERC mathematically impossible:

1. **Rank-one positive covariance.** With `Sigma = outer([.1,.2,.3,.4,.5], [.1,.2,.3,.4,.5])`, the inverse-volatility weights from ERC-01 still have exactly equal risk shares. Portfolio variance is positive even though matrix rank is one. A matrix inverse is unnecessary for evaluating the risk contributions.
2. **One zero-variance asset.** With `Sigma = diag([.01,.04,.09,.16,0])`, ETH has zero risk contribution. The reference weights `[.384,.192,.128,.096,.2]` give risk shares `[.25,.25,.25,.25,0]` and objective `0.05`. Equal five-way risk shares are impossible. The optimal objective `0.05` follows by minimizing the four risky shares' squared deviations subject to their sum being one. Many weights attain this same objective, so allocation uniqueness is lost.
3. **Zero portfolio variance.** Risk shares divide by portfolio variance. A zero covariance matrix, or a zero-risk portfolio in a singular matrix, makes these shares undefined and must produce a clear unavailable/error result instead of NaN, infinity, or invented equal risk shares.

The agreed production stability policy can therefore be stricter than mathematical feasibility: the risk-based target optimizer rejects singular matrices and condition numbers above `1e12`. This is a conservative numerical acceptance rule, not a claim that every rejected matrix lacks an ERC solution. Raw risk reporting may accept a positive-semidefinite singular matrix when portfolio variance is positive. The reference includes singular cases to preserve that distinction; it does not assert that production must optimize them.

Other numerical decisions supported by this audit:

- Normalize a valid nonnegative target once before calculating desired post-trade values. Reject zero-sum, negative, and nonfinite target inputs.
- Preserve full precision in calculations and round only output amounts. For money presented as an exhaustive cash allocation, reconcile cents explicitly.
- Keep covariance symmetry and positive-semidefiniteness validation distinct from a target optimizer's conditioning threshold. Reject materially indefinite covariance rather than masking it as a solver failure.
- Do not replace undefined zero-variance risk shares with equal percentages. Do not silently regularize covariance: adding a ridge changes the optimization problem and should be an explicit policy.
- Judge constrained results by feasibility, the declared objective, and an appropriate optimality residual. A nonzero risk-share objective can be correct under binding constraints.
- An exact convex buy-only projection has a unique solution; constrained ERC's first-order certificate does not provide the same global guarantee.

## Suggested production comparison tolerances

| Quantity | Absolute tolerance |
|---|---:|
| FX-converted DKK prices | `1e-10` |
| Full-precision returns | `1e-12` |
| Prompt's eight-decimal return fixtures | `5e-9` |
| Annual covariance entries | `1e-12` |
| Diagonal ERC weights | `1e-7` |
| Constrained ERC weights | `2e-5` |
| Constrained ERC objective | `1e-8` |
| Continuous buys, DKK | `1e-5` |
| Allocation constraint feasibility | `1e-8` |

Comparisons should use the full-precision JSON, not values rounded for display. A deterministic production solver can use a different algorithm and iteration history while satisfying the same mathematical fixtures and tolerances.
