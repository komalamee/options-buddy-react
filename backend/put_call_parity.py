"""
Put-Call Parity Analysis Module

Detects arbitrage opportunities through put-call parity violations
and identifies statistical outliers in options pricing.

Put-Call Parity Formula: C - P = S - K*e^(-rT)

Where:
- C = Call price
- P = Put price
- S = Stock price
- K = Strike price
- r = Risk-free rate
- T = Time to expiration (years)
"""

import math
from typing import List, Dict, Optional
import numpy as np


def calculate_put_call_parity_violation(
    call_price: float,
    put_price: float,
    stock_price: float,
    strike: float,
    time_to_expiry: float,
    risk_free_rate: float,
    threshold: float = 0.02
) -> Dict:
    """
    Detect put-call parity violations.

    Args:
        call_price: Market price of call option (mid price)
        put_price: Market price of put option (mid price)
        stock_price: Current stock price
        strike: Option strike price
        time_to_expiry: Time to expiration in years
        risk_free_rate: Annual risk-free rate (e.g., 0.045 for 4.5%)
        threshold: Violation threshold as percentage (default 0.02 = 2%)

    Returns:
        Dictionary containing:
        - parity_value: Theoretical S - K*e^(-rT)
        - market_spread: Actual C - P
        - violation_dollars: Dollar amount of violation
        - violation_pct: Violation as percentage of strike
        - is_violation: True if abs(violation) > threshold
        - arbitrage_type: 'call_overpriced' | 'put_overpriced' | 'no_violation'
    """
    # Calculate theoretical parity value: S - K*e^(-rT)
    discount_factor = math.exp(-risk_free_rate * time_to_expiry)
    parity_value = stock_price - (strike * discount_factor)

    # Calculate actual market spread: C - P
    market_spread = call_price - put_price

    # Calculate violation
    violation_dollars = market_spread - parity_value
    violation_pct = (violation_dollars / strike) * 100 if strike > 0 else 0

    # Determine if this is a violation
    is_violation = abs(violation_pct) > (threshold * 100)

    # Determine arbitrage type
    if is_violation:
        if violation_dollars > 0:
            arbitrage_type = 'call_overpriced'  # Calls trading too high relative to puts
        else:
            arbitrage_type = 'put_overpriced'   # Puts trading too high relative to calls
    else:
        arbitrage_type = 'no_violation'

    return {
        'parity_value': parity_value,
        'market_spread': market_spread,
        'violation_dollars': violation_dollars,
        'violation_pct': violation_pct,
        'is_violation': is_violation,
        'arbitrage_type': arbitrage_type
    }


def calculate_synthetic_prices(
    stock_price: float,
    strike: float,
    time_to_expiry: float,
    risk_free_rate: float,
    call_price: Optional[float] = None,
    put_price: Optional[float] = None
) -> Dict:
    """
    Calculate synthetic option prices based on put-call parity.

    From C - P = S - K*e^(-rT):
    - Synthetic Call: C = P + (S - K*e^(-rT))
    - Synthetic Put: P = C - (S - K*e^(-rT))

    Args:
        stock_price: Current stock price
        strike: Option strike price
        time_to_expiry: Time to expiration in years
        risk_free_rate: Annual risk-free rate
        call_price: Market call price (optional)
        put_price: Market put price (optional)

    Returns:
        Dictionary containing:
        - synthetic_call: What call should be worth based on put
        - synthetic_put: What put should be worth based on call
    """
    discount_factor = math.exp(-risk_free_rate * time_to_expiry)
    parity_value = stock_price - (strike * discount_factor)

    synthetic_call = put_price + parity_value if put_price is not None else None
    synthetic_put = call_price - parity_value if call_price is not None else None

    return {
        'synthetic_call': synthetic_call,
        'synthetic_put': synthetic_put
    }


def detect_statistical_outliers(
    options_data: List[Dict],
    metric: str = 'iv',
    threshold: float = 2.0
) -> List[Dict]:
    """
    Identify options that are statistical outliers (2+ std deviations from mean).

    Args:
        options_data: List of option dicts with metrics (iv, volume, etc.)
        metric: Which metric to analyze ('iv' for implied volatility)
        threshold: Z-score threshold (default 2.0 = 2 standard deviations)

    Returns:
        List of options with added fields:
        - <metric>_mean: Mean value across all options
        - <metric>_std: Standard deviation
        - <metric>_z_score: Z-score for this option
        - is_<metric>_outlier: True if abs(z_score) > threshold
    """
    if not options_data:
        return []

    # Extract metric values
    values = []
    for opt in options_data:
        val = opt.get(metric)
        if val is not None and not math.isnan(val):
            values.append(val)

    if len(values) < 3:  # Need at least 3 data points for meaningful stats
        # Return original data with null stats
        for opt in options_data:
            opt[f'{metric}_mean'] = None
            opt[f'{metric}_std'] = None
            opt[f'{metric}_z_score'] = 0.0
            opt[f'is_{metric}_outlier'] = False
        return options_data

    # Calculate mean and standard deviation
    mean = np.mean(values)
    std = np.std(values, ddof=1)  # Sample standard deviation

    # Calculate z-scores and identify outliers
    result = []
    for opt in options_data:
        val = opt.get(metric)

        if val is not None and not math.isnan(val) and std > 0:
            z_score = (val - mean) / std
            is_outlier = abs(z_score) > threshold
        else:
            z_score = 0.0
            is_outlier = False

        # Add statistical fields
        opt[f'{metric}_mean'] = mean
        opt[f'{metric}_std'] = std
        opt[f'{metric}_z_score'] = z_score
        opt[f'is_{metric}_outlier'] = is_outlier

        result.append(opt)

    return result


def calculate_opportunity_score(
    violation_pct: float,
    is_violation: bool,
    iv_z_score: float,
    is_iv_outlier: bool,
    total_volume: int,
    moneyness: float
) -> int:
    """
    Calculate opportunity score (0-100) based on multiple factors.

    Args:
        violation_pct: Put-call parity violation percentage
        is_violation: Whether parity violation exceeds threshold
        iv_z_score: Z-score of implied volatility
        is_iv_outlier: Whether IV is statistical outlier
        total_volume: Combined call + put volume
        moneyness: stock_price / strike (1.0 = ATM)

    Returns:
        Integer score from 0 to 100
    """
    score = 0

    # Put-Call Parity Violation (0-50 points)
    abs_violation_pct = abs(violation_pct)
    if is_violation:
        if abs_violation_pct >= 5:
            score += 50
        elif abs_violation_pct >= 3:
            score += 40
        elif abs_violation_pct >= 2:
            score += 30

    # IV Statistical Outlier (0-30 points)
    abs_z_score = abs(iv_z_score)
    if is_iv_outlier:
        if abs_z_score >= 3:
            score += 30
        elif abs_z_score >= 2.5:
            score += 20
        elif abs_z_score >= 2:
            score += 15

    # Liquidity bonus (0-10 points)
    if total_volume >= 500:
        score += 10
    elif total_volume >= 200:
        score += 5

    # Near-the-money bonus (0-10 points)
    # More reliable pricing for ATM options
    if 0.95 <= moneyness <= 1.05:  # Within 5% of ATM
        score += 10
    elif 0.90 <= moneyness <= 1.10:  # Within 10% of ATM
        score += 5

    return min(score, 100)  # Cap at 100
