"""Rep–store fit scoring from Route DNA + historical visit logs."""

from __future__ import annotations

from collections import defaultdict

from models import Rep, Store, VisitLog

SUCCESS_OUTCOMES = {"sale", "order_placed", "done"}

STORE_TYPE_ALIASES = {
    "pharmacy": "medical",
    "medical": "medical",
    "grocery": "kirana",
    "kirana": "kirana",
    "supermarket": "supermarket",
    "electronics": "general",
    "general": "general",
    "distributor": "distributor",
}

DISPLAY_TYPE = {
    "medical": "pharmacy / medical",
    "kirana": "kirana / grocery",
    "supermarket": "supermarket",
    "distributor": "distributor",
    "general": "general trade",
}


def normalize_store_type(store_type: str | None) -> str:
    key = (store_type or "general").lower().strip()
    return STORE_TYPE_ALIASES.get(key, key)


def _is_success(outcome: str | None, revenue: float | None) -> bool:
    if outcome in SUCCESS_OUTCOMES:
        return True
    return bool(revenue and revenue > 0)


def _conversion_rate(rep_dna: dict, store_type: str | None) -> float:
    rates = rep_dna.get("conversion_rates", {})
    normalized = normalize_store_type(store_type)
    if normalized in rates:
        return float(rates[normalized])
    for key, value in rates.items():
        if normalize_store_type(key) == normalized:
            return float(value)
    return float(rates.get("general", rates.get("kirana", 0.2)))


def _build_visit_stats(visit_logs: list[VisitLog], stores_by_id: dict[int, Store]) -> tuple[
    dict[int, list[VisitLog]],
    dict[str, list[VisitLog]],
]:
    by_store: dict[int, list[VisitLog]] = defaultdict(list)
    by_type: dict[str, list[VisitLog]] = defaultdict(list)
    for log in visit_logs:
        by_store[log.store_id].append(log)
        store = stores_by_id.get(log.store_id)
        stype = normalize_store_type(store.store_type if store else "general")
        by_type[stype].append(log)
    return by_store, by_type


def _type_success_rate(logs: list[VisitLog]) -> float:
    if not logs:
        return 0.0
    wins = sum(1 for log in logs if _is_success(log.outcome, log.revenue))
    return wins / len(logs)


def _type_avg_revenue(logs: list[VisitLog]) -> float:
    successes = [log.revenue or 0 for log in logs if _is_success(log.outcome, log.revenue)]
    if not successes:
        return 0.0
    return sum(successes) / len(successes)


def compute_rep_store_fit(
    rep: Rep,
    rep_dna: dict,
    stores: list[Store],
    visit_logs: list[VisitLog],
) -> dict:
    stores_by_id = {store.id: store for store in stores}
    visits_by_store, visits_by_type = _build_visit_stats(visit_logs, stores_by_id)

    conversion_rates = rep_dna.get("conversion_rates", {})
    normalized_rates = {
        normalize_store_type(key): float(value) for key, value in conversion_rates.items()
    }
    max_dna_rate = max(normalized_rates.values()) if normalized_rates else 0.5
    top_type = max(normalized_rates.items(), key=lambda item: item[1])[0] if normalized_rates else "general"
    top_type_pct = round(normalized_rates.get(top_type, 0) * 100)

    type_revenues = {
        stype: _type_avg_revenue(logs) for stype, logs in visits_by_type.items()
    }
    max_type_revenue = max(type_revenues.values()) if type_revenues else 1.0

    speed_factor = float(rep_dna.get("area_speed_factor") or rep.area_speed_factor or 1.0)
    speed_bonus = max(0.0, min(0.15, (1.2 - speed_factor) * 0.2))

    fit_items = []
    for store in stores:
        stype = normalize_store_type(store.store_type)
        dna_rate = _conversion_rate(rep_dna, store.store_type)
        dna_norm = dna_rate / max_dna_rate if max_dna_rate else dna_rate
        dna_match_pct = round(dna_rate * 100)

        store_logs = visits_by_store.get(store.id, [])
        visit_count = len(store_logs)
        store_wins = [log for log in store_logs if _is_success(log.outcome, log.revenue)]
        success_rate = len(store_wins) / visit_count if visit_count else 0.0
        avg_store_revenue = (
            sum(log.revenue or 0 for log in store_wins) / len(store_wins) if store_wins else 0.0
        )
        past_winner = bool(store_wins and success_rate >= 0.5)

        type_logs = visits_by_type.get(stype, [])
        type_success = _type_success_rate(type_logs)
        type_revenue = type_revenues.get(stype, 0.0)
        type_revenue_norm = type_revenue / max_type_revenue if max_type_revenue else 0.0

        history_score = 0.0
        if visit_count:
            history_score = min(
                1.0,
                (success_rate * 0.5)
                + (min(avg_store_revenue / max(store.avg_order_value or 1, 1), 1.5) * 0.35)
                + (0.15 if past_winner else 0.0),
            )
        elif type_logs:
            history_score = (type_success * 0.6) + (type_revenue_norm * 0.4)

        fit_score = round(
            min(
                100.0,
                (dna_norm * 0.45 + history_score * 0.45 + speed_bonus) * 100,
            ),
            1,
        )

        if past_winner:
            priority_label = "Past performer"
            reason = (
                f"Sold here before (avg Rs.{round(avg_store_revenue):,}) · "
                f"{round(success_rate * 100)}% success rate"
            )
        elif dna_norm >= 0.85:
            priority_label = "DNA top match"
            reason = (
                f"Strong {DISPLAY_TYPE.get(stype, stype)} fit · "
                f"{dna_match_pct}% conversion profile"
            )
        elif dna_norm >= 0.6:
            priority_label = "Good DNA match"
            reason = f"{dna_match_pct}% conversion at {DISPLAY_TYPE.get(stype, stype)} stores"
        elif type_logs and type_success >= 0.5:
            priority_label = "Category experience"
            reason = (
                f"Past success in {DISPLAY_TYPE.get(stype, stype)} "
                f"({round(type_success * 100)}% win rate)"
            )
        else:
            priority_label = "Standard"
            reason = f"Average fit for {DISPLAY_TYPE.get(stype, stype)}"

        fit_items.append(
            {
                "store_id": store.id,
                "store_name": store.name,
                "store_type": store.store_type,
                "fit_score": fit_score,
                "dna_match_pct": dna_match_pct,
                "priority_label": priority_label,
                "reason": reason,
                "historical_visits": visit_count,
                "past_winner": past_winner,
                "past_success_rate_pct": round(success_rate * 100),
                "past_avg_revenue": round(avg_store_revenue, 2),
            }
        )

    fit_items.sort(key=lambda item: (-item["fit_score"], -item["dna_match_pct"]))

    return {
        "rep_id": rep.id,
        "rep_name": rep.name,
        "top_store_type": DISPLAY_TYPE.get(top_type, top_type),
        "top_store_type_pct": top_type_pct,
        "avg_visit_time_minutes": rep.avg_visit_time_minutes,
        "area_speed_factor": speed_factor,
        "stores": fit_items,
    }
