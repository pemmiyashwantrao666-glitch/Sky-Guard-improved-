"""
============================================================================
SkyGuard — SHAP-Style Explainable AI Module
============================================================================
Lightweight additive attribution for anomaly detection without external ML
libraries. Computes per-parameter, per-layer contributions toward the final
anomaly score in a human-readable format compatible with SHAP waterfall
charts.

Usage:
  from shap_explainer import SHAPExplainer
  expl = SHAPExplainer(engine)
  result = engine.process(reading)
  explanation = expl.explain(result, reading, station_state)
  print(explanation.to_markdown())
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PARAM_LABEL = {
    "temperature": "Temperature",
    "humidity":    "Humidity",
    "pressure":    "Pressure",
}
PARAM_UNIT = {"temperature": "°C", "humidity": "%", "pressure": " hPa"}
PARAM_KEYS = ("temperature", "humidity", "pressure")

LAYER_WEIGHTS = {"L1": 0.25, "L2": 0.30, "L3": 0.25, "L4": 0.20}
ANOMALY_THRESHOLD = 0.50
WARNING_THRESHOLD = 0.30
Z_THRESHOLD = 2.5


# ---------------------------------------------------------------------------
# Safe helpers
# ---------------------------------------------------------------------------
def _safe_mean(vals):
    vals = [v for v in vals if v is not None and not math.isnan(v)]
    return statistics.mean(vals) if vals else None

def _safe_z(value, center, spread):
    if value is None or math.isnan(value):
        return 0.0
    if center is None or spread is None or spread == 0:
        return 0.0
    return abs((value - center) / spread)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------
@dataclass
class FeatureContribution:
    feature: str
    layer: str
    value: float
    contribution: float
    direction: str  # "increases" or "decreases" anomaly score
    evidence: str

@dataclass
class SHAPExplanation:
    base_value: float
    final_score: float
    contributions: list[FeatureContribution] = field(default_factory=list)
    top_drivers: list[str] = field(default_factory=list)

    def to_markdown(self) -> str:
        lines = [
            f"## SHAP-Style Explanation",
            f"",
            f"**Base (expected) score:** {self.base_value:.3f}",
            f"**Final anomaly score:** {self.final_score:.3f}",
            f"",
            f"### Feature Contributions (top drivers)",
        ]
        for c in self.contributions[:8]:
            arrow = "↑" if c.direction == "increases" else "↓"
            lines.append(f"- **{c.feature}** ({c.layer}): {arrow} {c.contribution:+.3f} — {c.evidence}")
        lines.append(f"")
        lines.append(f"**Primary root causes:** {', '.join(self.top_drivers)}")
        return "\n".join(lines)

    def to_dict(self) -> dict:
        return {
            "base_value": round(self.base_value, 3),
            "final_score": round(self.final_score, 3),
            "contributions": [
                {
                    "feature": c.feature,
                    "layer": c.layer,
                    "value": round(c.value, 2),
                    "contribution": round(c.contribution, 3),
                    "direction": c.direction,
                    "evidence": c.evidence,
                }
                for c in self.contributions
            ],
            "top_drivers": self.top_drivers,
        }


# ---------------------------------------------------------------------------
# Explainer
# ---------------------------------------------------------------------------
class SHAPExplainer:
    """Compute SHAP-style additive attributions for SkyGuard anomaly scores."""

    def __init__(self, engine: Any):
        self.engine = engine
        self.z_threshold = getattr(engine, "z_threshold", Z_THRESHOLD)
        self.layer_weights = getattr(engine, "layer_weights", LAYER_WEIGHTS)

    # ---------------- helpers ----------------
    def _extract_z(self, msg: str) -> float:
        import re
        m = re.search(r"([0-9.]+)(?:sigma|σ)", msg)
        return float(m.group(1)) if m else self.z_threshold + 1.0

    def _safe_mean(self, vals):
        vals = [v for v in vals if v is not None and not math.isnan(v)]
        return statistics.mean(vals) if vals else None

    # ---------------- main explain ----------------
    def explain(self, result: dict, reading: Any, station_state: Any) -> SHAPExplanation:
        """Build a full additive explanation from the engine output."""
        layers = result.get("layers_triggered", [])
        score = result.get("score", 0.0)
        layers_detail = result.get("layers_detail", {})

        # Base value: expected score for a normal reading
        base_value = 0.0
        contributions: list[FeatureContribution] = []

        # Per-layer contributions
        for layer_name in ["L1", "L2", "L3", "L4"]:
            issues = layers_detail.get(layer_name, [])
            if not issues:
                continue
            w = self.layer_weights.get(layer_name, 0.25)
            if layer_name in ("L1", "L4"):
                layer_score = w * min(1.0, len(issues) / 2)
            else:
                zs = [self._extract_z(m) for _, m in issues]
                zmax = max(zs) if zs else self.z_threshold
                strength = min(1.0, zmax / (self.z_threshold + 1.5))
                layer_score = w * strength

            # Split layer score among its issues proportionally by z-score
            for param, msg in issues:
                z = self._extract_z(msg)
                weight = z / (sum(self._extract_z(m) for _, m in issues) or 1.0)
                contrib = layer_score * weight
                direction = "increases" if contrib > 0 else "decreases"
                contributions.append(FeatureContribution(
                    feature=f"{PARAM_LABEL.get(param, param)} {PARAM_UNIT.get(param, '')}",
                    layer=f"L{layer_name[1]} {self._layer_label(layer_name)}",
                    value=getattr(reading, param, 0.0) if hasattr(reading, param) else 0.0,
                    contribution=round(contrib, 3),
                    direction=direction,
                    evidence=msg,
                ))

        # Sort by absolute contribution
        contributions.sort(key=lambda c: abs(c.contribution), reverse=True)
        top_drivers = [c.feature for c in contributions[:3]]

        return SHAPExplanation(
            base_value=base_value,
            final_score=score,
            contributions=contributions,
            top_drivers=top_drivers,
        )

    def _layer_label(self, layer: str) -> str:
        return {
            "L1": "Physical",
            "L2": "Temporal",
            "L3": "Spatial",
            "L4": "Physics",
        }.get(layer, layer)
