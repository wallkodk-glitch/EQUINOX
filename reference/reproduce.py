#!/usr/bin/env python3
"""Independent mathematical references for EQUINOX v1.

Run with Python, NumPy, and SciPy. No production files are imported or executed.
The checked JSON is deterministic except for dependency version metadata and
last-bit floating-point differences between numerical-library versions.
"""

from __future__ import annotations

import argparse
from decimal import Decimal, localcontext
import json
from pathlib import Path
import platform

import numpy as np
import scipy
from scipy.optimize import minimize, root


ASSETS = ["GOOGL", "ISRG", "TSM", "BTC", "ETH"]
N = len(ASSETS)
CRYPTO = np.array([0.0, 0.0, 0.0, 1.0, 1.0])


def plain(value):
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {key: plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(item) for item in value]
    return value


def assert_close(actual, expected, atol=1e-10):
    np.testing.assert_allclose(actual, expected, atol=atol, rtol=0)


def risk_quantities(weights, covariance):
    weights = np.asarray(weights, dtype=float)
    covariance = np.asarray(covariance, dtype=float)
    sigma_w = covariance @ weights
    variance = float(weights @ sigma_w)
    if not np.isfinite(variance) or variance <= 0.0:
        raise ValueError("Portfolio variance must be strictly positive.")
    volatility = np.sqrt(variance)
    shares = weights * sigma_w / variance
    marginal = sigma_w / volatility
    absolute = weights * marginal
    return {
        "portfolio_variance": variance,
        "portfolio_volatility": volatility,
        "marginal_volatility": marginal,
        "absolute_volatility_contributions": absolute,
        "risk_shares": shares,
        "objective": float(np.sum((shares - 1.0 / len(weights)) ** 2)),
    }


def erc_objective_gradient(weights, covariance):
    weights = np.asarray(weights, dtype=float)
    sigma_w = covariance @ weights
    variance = float(weights @ sigma_w)
    if variance <= 0 or not np.isfinite(variance):
        raise ValueError("ERC objective is undefined at zero portfolio variance.")
    shares = weights * sigma_w / variance
    jacobian = (np.diag(sigma_w) + weights[:, None] * covariance) / variance
    jacobian -= np.outer(shares, 2.0 * sigma_w / variance)
    residual = shares - 1.0 / len(weights)
    return float(residual @ residual), 2.0 * jacobian.T @ residual


def kkt_residuals(weights, covariance, lower, upper, crypto_cap, active_tol=1e-8):
    """Use g <= 0 constraints and L = f + lambda*h + sum(mu*g)."""
    _, gradient = erc_objective_gradient(weights, covariance)
    normals = [np.ones(N)]
    names = ["sum(weights)-1"]
    values = [float(weights.sum() - 1)]
    inequality_flags = [False]
    for index in range(N):
        if weights[index] - lower[index] <= active_tol:
            vector = np.zeros(N)
            vector[index] = -1.0
            normals.append(vector)
            names.append(f"lower[{ASSETS[index]}]-weight")
            values.append(float(lower[index] - weights[index]))
            inequality_flags.append(True)
        if upper[index] - weights[index] <= active_tol:
            vector = np.zeros(N)
            vector[index] = 1.0
            normals.append(vector)
            names.append(f"weight-upper[{ASSETS[index]}]")
            values.append(float(weights[index] - upper[index]))
            inequality_flags.append(True)
    if crypto_cap - CRYPTO @ weights <= active_tol:
        normals.append(CRYPTO.copy())
        names.append("BTC+ETH-crypto_cap")
        values.append(float(CRYPTO @ weights - crypto_cap))
        inequality_flags.append(True)
    matrix = np.column_stack(normals)
    multipliers = np.linalg.lstsq(matrix, -gradient, rcond=None)[0]
    inequality_multipliers = multipliers[np.array(inequality_flags)]
    primal = max(
        abs(float(weights.sum() - 1)),
        float(np.max(np.maximum(lower - weights, 0))),
        float(np.max(np.maximum(weights - upper, 0))),
        max(0.0, float(CRYPTO @ weights - crypto_cap)),
    )
    dual = max(0.0, float(-min(inequality_multipliers, default=0.0)))
    complementarity = max(
        (abs(float(multiplier * value)) for multiplier, value, is_ineq in
         zip(multipliers, values, inequality_flags) if is_ineq),
        default=0.0,
    )
    return {
        "constraint_sign_convention": "g <= 0; L=f+lambda*(sum(w)-1)+sum(mu*g)",
        "gradient": gradient,
        "active_constraints": names,
        "multipliers": dict(zip(names, multipliers)),
        "primal_linf": primal,
        "stationarity_linf": float(np.max(np.abs(gradient + matrix @ multipliers))),
        "dual_violation_linf": dual,
        "complementarity_linf": complementarity,
    }


def fx_fixture():
    usd = [Decimal(x) for x in ["100", "102", "101", "104"]]
    fx = [Decimal(x) for x in ["6.8", "6.9", "6.85", "7"]]
    with localcontext() as context:
        context.prec = 40
        dkk = [price * rate for price, rate in zip(usd, fx)]
        returns = [dkk[i] / dkk[i - 1] - 1 for i in range(1, len(dkk))]
    expected_dkk = [680, 703.8, 691.85, 728]
    quoted_returns = [0.035, -0.01697926, 0.05225121]
    result = {
        "id": "FX-01",
        "usd_prices": list(map(float, usd)),
        "dkk_per_usd": list(map(float, fx)),
        "dkk_prices": list(map(float, dkk)),
        "simple_returns": list(map(float, returns)),
        "high_precision_simple_returns": list(map(str, returns)),
        "prompt_expected_returns": quoted_returns,
        "return_rounding_max_abs_error": max(abs(float(a) - b) for a, b in zip(returns, quoted_returns)),
    }
    assert_close(result["dkk_prices"], expected_dkk)
    assert_close(result["simple_returns"], quoted_returns, 5e-9)
    return result


def covariance_fixture():
    returns = np.array([[.01, .02, 0], [-.01, .01, .02], [.02, -.01, .01], [0, 0, -.01]])
    centered = returns - returns.mean(axis=0)
    # Explicit matrix multiplication is checked against NumPy's ddof=1 covariance.
    sample = centered.T @ centered / (len(returns) - 1)
    assert_close(sample, np.cov(returns, rowvar=False, ddof=1), 1e-18)
    annual = sample * 252
    expected = np.array([[.042, -.0168, -.0084], [-.0168, .042, 0], [-.0084, 0, .042]])
    assert_close(annual, expected, 1e-16)
    assert_close(np.sqrt(np.diag(annual)), [.2049390153] * 3, 5e-11)
    return {
        "id": "COV-01", "returns": returns, "ddof": 1,
        "annualization_factor": 252, "column_means": returns.mean(axis=0),
        "sample_covariance": sample, "annual_covariance": annual,
        "annual_volatilities": np.sqrt(np.diag(annual)),
        "annual_covariance_eigenvalues": np.linalg.eigvalsh(annual),
    }


def diagonal_erc_fixture():
    volatilities = np.array([.1, .2, .3, .4, .5])
    covariance = np.diag(volatilities ** 2)
    exact_weights = (1.0 / volatilities) / np.sum(1.0 / volatilities)
    expected = [.43795620, .21897810, .1459854, .10948905, .08759124]
    constraints = [{"type": "eq", "fun": lambda w: w.sum() - 1,
                    "jac": lambda w: np.ones(N)}]
    result = minimize(
        lambda w: erc_objective_gradient(w, covariance)[0], np.full(N, 1 / N),
        jac=lambda w: erc_objective_gradient(w, covariance)[1],
        bounds=[(0, 1)] * N, constraints=constraints, method="SLSQP",
        options={"ftol": 1e-15, "maxiter": 2000},
    )
    assert result.success, result.message
    assert_close(exact_weights, expected, 5e-9)
    assert_close(result.x, exact_weights, 2e-8)
    quantities = risk_quantities(exact_weights, covariance)
    assert_close(quantities["risk_shares"], np.full(N, .2), 1e-15)
    return {
        "id": "ERC-01", "annual_covariance": covariance,
        "weights": exact_weights, "exact_weight_fractions": ["60/137", "30/137", "20/137", "15/137", "12/137"],
        "scipy_weights": result.x, "scipy_objective": result.fun,
        "scipy_max_abs_weight_error": float(np.max(np.abs(result.x - exact_weights))),
        **quantities,
    }


def constrained_erc_fixture():
    volatilities = np.array([.2, .28, .35, .65, .85])
    correlation = np.array([
        [1, .25, .40, .05, .05],
        [.25, 1, .30, .10, .10],
        [.40, .30, 1, .15, .15],
        [.05, .10, .15, 1, .65],
        [.05, .10, .15, .65, 1],
    ])
    covariance = np.diag(volatilities) @ correlation @ np.diag(volatilities)
    lower = np.array([.05, .05, .05, .03, .03])
    upper = np.array([.32, .40, .40, .20, .20])
    cap = .12
    assert np.linalg.eigvalsh(covariance).min() > 0
    constraints = [
        {"type": "eq", "fun": lambda w: w.sum() - 1, "jac": lambda w: np.ones(N)},
        {"type": "ineq", "fun": lambda w: cap - CRYPTO @ w, "jac": lambda w: -CRYPTO},
    ]
    rng = np.random.default_rng(20261002)
    starts = [np.array([.32, .30, .26, .06, .06]), np.full(N, .2)]
    starts.extend(rng.dirichlet(np.ones(N), 62))
    solutions = []
    for start in starts:
        result = minimize(
            lambda w: erc_objective_gradient(w, covariance)[0], start,
            jac=lambda w: erc_objective_gradient(w, covariance)[1],
            bounds=list(zip(lower, upper)), constraints=constraints, method="SLSQP",
            options={"ftol": 1e-14, "maxiter": 3000},
        )
        if result.success:
            solutions.append(result)
    assert len(solutions) >= 60, f"Only {len(solutions)}/{len(starts)} starts converged"
    best = min(solutions, key=lambda result: result.fun)
    assert abs(best.x[0] - upper[0]) < 1e-8
    assert abs(CRYPTO @ best.x - cap) < 1e-8

    # Independently polish the two free coordinates on the observed active face.
    # GOOGL=.32, BTC+ETH=.12, and ISRG+TSM=.56.
    def expand(coords):
        isrg, btc = coords
        return np.array([upper[0], isrg, 1 - upper[0] - cap - isrg, btc, cap - btc])

    def face_stationarity(coords):
        _, gradient = erc_objective_gradient(expand(coords), covariance)
        return np.array([gradient[1] - gradient[2], gradient[3] - gradient[4]])

    polished = root(face_stationarity, best.x[[1, 3]], method="hybr", options={"xtol": 1e-11})
    weights = expand(polished.x)
    assert np.max(np.abs(face_stationarity(polished.x))) < 1e-10
    residuals = kkt_residuals(weights, covariance, lower, upper, cap)
    assert residuals["primal_linf"] < 1e-12
    assert residuals["stationarity_linf"] < 1e-10
    assert residuals["dual_violation_linf"] < 1e-12
    assert residuals["complementarity_linf"] < 1e-12
    assert_close(best.x, weights, 1e-6)

    # Check the analytic derivative against central finite differences at an
    # interior point, independently of the constrained optimum.
    probe = np.array([.27, .29, .31, .06, .07])
    h = 1e-6
    finite_difference = np.array([
        (erc_objective_gradient(probe + np.eye(N)[j] * h, covariance)[0]
         - erc_objective_gradient(probe - np.eye(N)[j] * h, covariance)[0]) / (2 * h)
        for j in range(N)
    ])
    analytic = erc_objective_gradient(probe, covariance)[1]
    assert_close(analytic, finite_difference, 1e-8)
    return {
        "id": "ERC-02", "purpose": "Independent audit fixture; these bounds are not application defaults.",
        "annual_volatilities": volatilities, "correlation": correlation,
        "annual_covariance": covariance, "covariance_eigenvalues": np.linalg.eigvalsh(covariance),
        "lower_bounds": lower, "upper_bounds": upper, "crypto_cap": cap,
        "weights": weights, **risk_quantities(weights, covariance),
        "kkt": residuals,
        "multistart": {
            "method": "SciPy SLSQP with analytic gradient; active-face root polish",
            "random_seed": 20261002, "starts": len(starts), "successful_starts": len(solutions),
            "minimum_objective": float(min(result.fun for result in solutions)),
            "maximum_successful_objective": float(max(result.fun for result in solutions)),
            "maximum_weight_distance_from_polished": float(max(np.max(np.abs(result.x - weights)) for result in solutions)),
            "global_optimality_claim": False,
        },
        "analytic_gradient_max_abs_finite_difference_error": float(np.max(np.abs(analytic - finite_difference))),
    }


def normalize_target(target):
    target = np.asarray(target, dtype=float)
    if target.shape != (N,) or not np.isfinite(target).all() or np.any(target < 0) or target.sum() <= 0:
        raise ValueError("Target must be five finite nonnegative values with positive sum.")
    return target / target.sum()


def simplex_projection(vector, cash):
    """Exact Euclidean projection onto {x >= 0, sum(x) = cash}."""
    vector = np.asarray(vector, dtype=float)
    if cash == 0:
        return np.zeros_like(vector), float(np.max(vector))
    descending = np.sort(vector)[::-1]
    cumulative = np.cumsum(descending)
    indexes = np.arange(1, len(vector) + 1)
    eligible = descending - (cumulative - cash) / indexes > 0
    rho = np.flatnonzero(eligible)[-1]
    theta = float((cumulative[rho] - cash) / (rho + 1))
    return np.maximum(vector - theta, 0), theta


def rounded_cents(buys, cash):
    """Largest remainder, stable asset-order tie break; fixture cash is whole cents."""
    cash_cents = int(round(cash * 100))
    assert abs(cash * 100 - cash_cents) < 1e-7
    raw = np.asarray(buys) * 100
    cents = np.floor(raw + 1e-9).astype(int)
    remaining = cash_cents - int(cents.sum())
    fractions = raw - cents
    order = np.argsort(-fractions, kind="stable")
    assert 0 <= remaining < len(buys)
    cents[order[:remaining]] += 1
    assert cents.sum() == cash_cents
    assert np.all(cents >= 0)
    return cents.astype(float) / 100


def buy_fixture(case_id, values, cash, target):
    values = np.asarray(values, dtype=float)
    if values.shape != (N,) or not np.isfinite(values).all() or np.any(values < 0):
        raise ValueError("Values must be five finite nonnegative numbers.")
    if not np.isfinite(cash) or cash < 0:
        raise ValueError("Cash must be finite and nonnegative.")
    normalized = normalize_target(target)
    total = float(values.sum() + cash)
    if total <= 0:
        raise ValueError("Post-trade portfolio value must be positive.")
    ideal = normalized * total - values
    buys, theta = simplex_projection(ideal, cash)
    post = (values + buys) / total
    objective = float(np.sum((post - normalized) ** 2))

    # SciPy sees only post-trade weights. Its independent variable z=x/total
    # avoids poor currency-unit scaling in the QP solver.
    cash_fraction = cash / total
    if cash > 0:
        scipy_result = minimize(
            lambda z: float(np.sum((values / total + z - normalized) ** 2)),
            np.full(N, cash_fraction / N),
            jac=lambda z: 2 * (values / total + z - normalized),
            method="SLSQP", bounds=[(0, cash_fraction)] * N,
            constraints=[{"type": "eq", "fun": lambda z: z.sum() - cash_fraction,
                          "jac": lambda z: np.ones(N)}],
            options={"ftol": 1e-15, "maxiter": 2000},
        )
        assert scipy_result.success, scipy_result.message
        scipy_raw_buys = scipy_result.x * total
        # SLSQP identifies the active set; solve its linear KKT equations to
        # remove the stopping-tolerance error without using the projection.
        active = np.flatnonzero(scipy_result.x > max(1e-12, cash_fraction * 1e-8))
        count = len(active)
        kkt_matrix = np.block([[2 * np.eye(count), np.ones((count, 1))],
                               [np.ones((1, count)), np.zeros((1, 1))]])
        rhs = np.r_[-2 * (values / total - normalized)[active], cash_fraction]
        solved = np.linalg.solve(kkt_matrix, rhs)
        scipy_buys = np.zeros(N)
        scipy_buys[active] = solved[:-1] * total
        assert_close(scipy_raw_buys, buys, 2e-4)
    else:
        scipy_raw_buys = np.zeros(N)
        scipy_buys = np.zeros(N)
    assert_close(scipy_buys, buys, 2e-6)
    assert abs(buys.sum() - cash) < 1e-8
    assert np.all(buys >= 0)
    assert abs(post.sum() - 1) < 1e-12

    # Currency-space objective is ||x-ideal||^2. For g=-x<=0,
    # stationarity is 2(x-ideal)+lambda-mu=0.
    multiplier = 2 * theta
    lower_multipliers = 2 * (buys - ideal) + multiplier
    lower_multipliers[buys > 1e-8] = 0.0
    stationarity = 2 * (buys - ideal) + multiplier - lower_multipliers
    assert np.max(np.abs(stationarity)) < 1e-8
    assert lower_multipliers.min() > -1e-8
    assert np.max(np.abs(lower_multipliers * buys)) < 1e-7
    return {
        "id": case_id, "current_values_dkk": values, "cash_dkk": cash,
        "target_input": target, "target_input_sum": float(np.sum(target)),
        "normalized_target": normalized, "post_trade_total_dkk": total,
        "ideal_unconstrained_buys_dkk": ideal, "simplex_threshold_dkk": theta,
        "buys_dkk": buys, "buys_rounded_to_cents_dkk": rounded_cents(buys, cash),
        "post_trade_weights": post, "l2_squared_weight_error": objective,
        "scipy_method": "SLSQP in weight coordinates; linear KKT polish on SLSQP's active set",
        "scipy_raw_buys_dkk": scipy_raw_buys,
        "scipy_raw_max_abs_buy_error_dkk": float(np.max(np.abs(scipy_raw_buys - buys))),
        "scipy_buys_dkk": scipy_buys,
        "scipy_max_abs_buy_error_dkk": float(np.max(np.abs(scipy_buys - buys))),
        "kkt": {
            "objective": "sum((x-ideal)^2); g=-x<=0",
            "equality_multiplier": multiplier, "lower_bound_multipliers": lower_multipliers,
            "cash_balance_abs_dkk": float(abs(buys.sum() - cash)),
            "stationarity_linf": float(np.max(np.abs(stationarity))),
            "dual_violation_linf": max(0.0, float(-lower_multipliers.min())),
            "complementarity_linf": float(np.max(np.abs(lower_multipliers * buys))),
        },
    }


def singular_fixtures():
    volatilities = np.array([.1, .2, .3, .4, .5])
    rank_one = np.outer(volatilities, volatilities)
    weights = (1 / volatilities) / np.sum(1 / volatilities)
    rank_one_risk = risk_quantities(weights, rank_one)
    assert_close(rank_one_risk["risk_shares"], np.full(N, .2), 1e-15)
    risk_free_cov = np.diag([.01, .04, .09, .16, 0])
    risky_weights = np.array([1 / .1, 1 / .2, 1 / .3, 1 / .4])
    risky_weights = risky_weights / risky_weights.sum() * .8
    with_risk_free = np.append(risky_weights, .2)
    risk_free_risk = risk_quantities(with_risk_free, risk_free_cov)
    assert_close(risk_free_risk["risk_shares"], [.25, .25, .25, .25, 0], 1e-15)
    assert_close(risk_free_risk["objective"], .05, 1e-15)
    rejected = False
    try:
        risk_quantities(np.full(N, .2), np.zeros((N, N)))
    except ValueError:
        rejected = True
    assert rejected
    return [
        {"id": "ERC-SINGULAR-01", "annual_covariance": rank_one,
         "matrix_rank": int(np.linalg.matrix_rank(rank_one)), "weights": weights,
         **rank_one_risk,
         "interpretation": "PSD rank-one covariance still admits exact ERC and positive portfolio variance."},
        {"id": "ERC-SINGULAR-02", "annual_covariance": risk_free_cov,
         "matrix_rank": int(np.linalg.matrix_rank(risk_free_cov)), "weights": with_risk_free,
         **risk_free_risk,
         "interpretation": "Zero-variance ETH cannot contribute positive risk. Minimum five-asset objective is 0.05; many weights attain it."},
        {"id": "ERC-ZERO-01", "annual_covariance": np.zeros((N, N)),
         "expected_status": "reject_undefined_zero_portfolio_variance", "rejection_verified": rejected},
    ]


def invalid_input_checks():
    cases = [
        ("negative_cash", [1] * N, -1, [.2] * N),
        ("negative_holding", [-1, 1, 1, 1, 1], 1, [.2] * N),
        ("zero_target_sum", [1] * N, 1, [0] * N),
        ("negative_target", [1] * N, 1, [-.1, .3, .3, .3, .2]),
        ("nonfinite_target", [1] * N, 1, [float("nan"), .2, .2, .2, .2]),
        ("zero_post_trade_value", [0] * N, 0, [.2] * N),
    ]
    result = []
    for name, values, cash, target in cases:
        try:
            buy_fixture(name, values, cash, target)
        except ValueError as error:
            result.append({"id": name, "rejected": True, "reason": str(error)})
        else:
            raise AssertionError(f"Invalid input {name} was accepted")
    return result


def build_reference():
    return {
        "schema_version": 1,
        "provenance": {
            "implementation": "Independent Python/NumPy/SciPy reference; no production imports",
            "python_version": platform.python_version(),
            "numpy_version": np.__version__, "scipy_version": scipy.__version__,
            "asset_order": ASSETS,
            "equations": {
                "fx": "P_DKK[t] = P_USD[t] * FX_DKK_per_USD[t]",
                "returns": "r[t] = P_DKK[t]/P_DKK[t-1] - 1",
                "covariance": "Sigma_annual = 252 * centered.T @ centered / (observations-1)",
                "risk_share": "w[i]*(Sigma@w)[i] / (w.T@Sigma@w)",
                "erc_objective": "sum((risk_share[i] - 1/N)^2)",
                "buy_objective": "min_x sum(((v[i]+x[i])/(sum(v)+C)-normalized_target[i])^2), x>=0, sum(x)=C",
                "buy_projection": "y=(sum(v)+C)*normalized_target-v; x=max(y-theta,0), sum(x)=C",
            },
        },
        "fx": fx_fixture(), "covariance": covariance_fixture(),
        "erc": [diagonal_erc_fixture(), constrained_erc_fixture()],
        "buy_only": [
            buy_fixture("BUY-01", [2000, 2000, 3000, 1800, 1200], 2500,
                        [.26222622, .22582258, .20692069, .17811781, .12691269]),
            buy_fixture("BUY-02-balanced", [1000] * N, 1000, [.2] * N),
            buy_fixture("BUY-03-heavy-overweight", [9000, 250, 250, 250, 250], 2500, [.2] * N),
            buy_fixture("BUY-04-zero-cash", [2000, 2000, 3000, 1800, 1200], 0, [.2] * N),
            buy_fixture("BUY-05-empty-holdings", [0] * N, 1000, [1, 2, 3, 2, 2]),
            buy_fixture("BUY-06-sparse-target", [100, 0, 0, 0, 0], 10, [1, 0, 0, 0, 0]),
            buy_fixture("BUY-07-multiple-blocked", [5000, 3500, 500, 500, 500], 500, [.2] * N),
            buy_fixture("BUY-08-small-cash", [2000, 2000, 3000, 1800, 1200], .03, [.2] * N),
        ],
        "singular_and_zero_variance": singular_fixtures(),
        "invalid_inputs": invalid_input_checks(),
        "comparison_tolerances": {
            "fx_prices_dkk_abs": 1e-10, "full_precision_returns_abs": 1e-12,
            "prompt_rounded_returns_abs": 5e-9, "annual_covariance_abs": 1e-12,
            "diagonal_erc_weights_abs": 1e-7, "constrained_erc_weights_abs": 2e-5,
            "constrained_erc_objective_abs": 1e-8, "buy_dkk_abs": 1e-5,
            "constraint_feasibility_abs": 1e-8,
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("reference.json"))
    parser.add_argument("--check", action="store_true", help="Validate the committed golden values without rewriting them")
    args = parser.parse_args()
    reference = plain(build_reference())
    if args.check:
        expected = json.loads(args.output.read_text())
        for key in ("dkk_prices", "simple_returns"):
            assert_close(reference["fx"][key], expected["fx"][key], 1e-12)
        for key in ("annual_covariance", "annual_volatilities"):
            assert_close(reference["covariance"][key], expected["covariance"][key], 1e-12)
        for actual, golden in zip(reference["erc"], expected["erc"], strict=True):
            assert actual["id"] == golden["id"]
            assert_close(actual["weights"], golden["weights"], 2e-5)
            assert_close(actual["objective"], golden["objective"], 1e-8)
        for actual, golden in zip(reference["buy_only"], expected["buy_only"], strict=True):
            assert actual["id"] == golden["id"]
            assert_close(actual["buys_dkk"], golden["buys_dkk"], 1e-5)
        print("Committed golden references match the independent recalculation.")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(reference, indent=2, allow_nan=False) + "\n")
    constrained = reference["erc"][1]
    first_buy = reference["buy_only"][0]
    print("All independent reference assertions passed.")
    print(f"{'Checked' if args.check else 'Written'}: {args.output}")
    print("BUY-01 normalized target:", first_buy["normalized_target"])
    print("BUY-01 optimal buys DKK:", first_buy["buys_dkk"])
    print("ERC-02 constrained weights:", constrained["weights"])
    print("ERC-02 objective:", constrained["objective"])
    print("ERC-02 stationarity residual:", constrained["kkt"]["stationarity_linf"])


if __name__ == "__main__":
    main()
