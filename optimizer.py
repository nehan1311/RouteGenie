import math
from datetime import date, datetime, time, timedelta

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

EARTH_RADIUS_METERS = 6371000
MUMBAI_AVG_SPEED_KMPH = 30
MAX_ROUTE_SECONDS = 28800


def compute_distance_matrix(stores: list[dict]) -> list[list[float]]:
    matrix = []

    for origin in stores:
        row = []
        for destination in stores:
            row.append(
                haversine_distance(
                    origin["lat"],
                    origin["lng"],
                    destination["lat"],
                    destination["lng"],
                )
            )
        matrix.append(row)

    return matrix


def haversine_distance(
    origin_lat: float,
    origin_lng: float,
    destination_lat: float,
    destination_lng: float,
) -> float:
    lat1 = math.radians(origin_lat)
    lat2 = math.radians(destination_lat)
    delta_lat = math.radians(destination_lat - origin_lat)
    delta_lng = math.radians(destination_lng - origin_lng)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_METERS * c


def generate_route(
    rep: dict,
    stores: list[dict],
    start_lat: float,
    start_lng: float,
) -> dict:
    locations = [
        {
            "store_id": 0,
            "name": "Depot",
            "lat": start_lat,
            "lng": start_lng,
            "avg_order_value": 0,
            "store_type": "depot",
            "urgency_score": 0,
            "urgency_status": "depot",
        },
        *stores,
    ]
    distance_matrix = compute_distance_matrix(locations)
    ordered_location_indices = solve_route(rep, locations, distance_matrix)

    if ordered_location_indices is None:
        ordered_stores = sorted(
            stores,
            key=lambda store: store["urgency_score"],
            reverse=True,
        )
    else:
        ordered_stores = [
            locations[index] for index in ordered_location_indices if index != 0
        ]

    return build_route_response(rep, ordered_stores, locations, distance_matrix)


def solve_route(
    rep: dict,
    locations: list[dict],
    distance_matrix: list[list[float]],
) -> list[int] | None:
    manager = pywrapcp.RoutingIndexManager(len(locations), 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(distance_matrix[from_node][to_node] * 10)

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    speed_mps = (MUMBAI_AVG_SPEED_KMPH * 1000 / 3600) * rep["area_speed_factor"]
    service_seconds = int(rep["avg_visit_time_minutes"] * 60)

    def time_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        travel_seconds = distance_matrix[from_node][to_node] / speed_mps
        service_time = 0 if from_node == 0 else service_seconds
        return int(travel_seconds + service_time)

    time_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(
        time_callback_index,
        0,
        MAX_ROUTE_SECONDS,
        True,
        "Time",
    )

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.AUTOMATIC
    )
    search_parameters.time_limit.seconds = 10

    solution = routing.SolveWithParameters(search_parameters)
    if solution is None:
        return None

    ordered_indices = []
    index = routing.Start(0)
    while not routing.IsEnd(index):
        ordered_indices.append(manager.IndexToNode(index))
        index = solution.Value(routing.NextVar(index))

    return ordered_indices


def build_route_response(
    rep: dict,
    ordered_stores: list[dict],
    locations: list[dict],
    distance_matrix: list[list[float]],
) -> dict:
    today = date.today()
    current_time = datetime.combine(today, time(hour=9))
    speed_mps = (MUMBAI_AVG_SPEED_KMPH * 1000 / 3600) * rep["area_speed_factor"]
    visit_duration_minutes = rep["avg_visit_time_minutes"]
    conversion_rates = rep["dna_profile"].get("conversion_rates", {})

    location_index_by_store_id = {
        location["store_id"]: index for index, location in enumerate(locations)
    }
    previous_index = 0
    route_stops = []
    estimated_total_revenue = 0.0
    total_time_minutes = 0

    for order, store in enumerate(ordered_stores, start=1):
        store_index = location_index_by_store_id[store["store_id"]]
        travel_seconds = distance_matrix[previous_index][store_index] / speed_mps
        travel_time_minutes = round(travel_seconds / 60)
        current_time += timedelta(minutes=travel_time_minutes)

        conversion_rate = conversion_rates.get(store["store_type"], 0)
        estimated_revenue = round(store["avg_order_value"] * conversion_rate, 2)
        estimated_total_revenue += estimated_revenue
        total_time_minutes += travel_time_minutes + visit_duration_minutes

        route_stops.append(
            {
                "order": order,
                "store_id": store["store_id"],
                "store_name": store["name"],
                "lat": store["lat"],
                "lng": store["lng"],
                "store_type": store["store_type"],
                "urgency_status": store["urgency_status"],
                "planned_arrival": current_time.strftime("%H:%M"),
                "travel_time_minutes": travel_time_minutes,
                "visit_duration_minutes": visit_duration_minutes,
                "estimated_revenue": estimated_revenue,
                "status": "pending",
            }
        )

        current_time += timedelta(minutes=visit_duration_minutes)
        previous_index = store_index

    return {
        "rep_id": rep["id"],
        "rep_name": rep["name"],
        "date": today.isoformat(),
        "total_stores": len(route_stops),
        "estimated_total_revenue": round(estimated_total_revenue, 2),
        "estimated_total_time_minutes": int(total_time_minutes),
        "route": route_stops,
    }


def replan_route(
    current_route: dict,
    cancelled_store_id: int,
    rep: dict,
    current_time_str: str,
) -> dict:
    route_stops = current_route.get("route", [])
    completed = [
        stop.copy()
        for stop in route_stops
        if stop.get("status") in {"done", "completed"}
    ]
    remaining = [
        stop.copy()
        for stop in route_stops
        if stop.get("status") == "pending"
        and stop.get("store_id") != cancelled_store_id
    ]
    cancelled_stop = next(
        (
            stop
            for stop in route_stops
            if stop.get("store_id") == cancelled_store_id
        ),
        None,
    )

    remaining_minutes = calculate_remaining_work_minutes(current_time_str)
    filtered_remaining = fit_stops_to_budget(
        remaining,
        remaining_minutes,
        rep["avg_visit_time_minutes"],
    )

    depot_lat, depot_lng = get_current_depot(current_route, completed, filtered_remaining)
    reoptimized_remaining = optimize_remaining_stops(
        rep,
        filtered_remaining,
        depot_lat,
        depot_lng,
    )
    updated_remaining = rebuild_remaining_stops(
        rep,
        reoptimized_remaining,
        depot_lat,
        depot_lng,
        current_route.get("date", date.today().isoformat()),
        current_time_str,
    )

    route = []
    for order, stop in enumerate(completed, start=1):
        stop["order"] = order
        stop["status"] = "done"
        route.append(stop)

    for offset, stop in enumerate(updated_remaining, start=len(route) + 1):
        stop["order"] = offset
        route.append(stop)

    estimated_total_revenue = round(
        sum(stop.get("estimated_revenue", 0) for stop in updated_remaining),
        2,
    )
    estimated_total_time_minutes = sum(
        stop.get("travel_time_minutes", 0) + stop.get("visit_duration_minutes", 0)
        for stop in updated_remaining
    )
    cancelled_revenue = (
        cancelled_stop.get("estimated_revenue", 0) if cancelled_stop else 0
    )

    return {
        "rep_id": current_route.get("rep_id", rep["id"]),
        "rep_name": current_route.get("rep_name", rep["name"]),
        "date": current_route.get("date", date.today().isoformat()),
        "replanned_at": current_time_str,
        "cancelled_store": {
            "store_id": cancelled_store_id,
            "store_name": cancelled_stop.get("store_name") if cancelled_stop else None,
            "reason": current_route.get("cancellation_reason", "cancelled"),
        },
        "total_stores": len(route),
        "completed_stores": len(completed),
        "remaining_stores": len(updated_remaining),
        "estimated_total_revenue": estimated_total_revenue,
        "revenue_impact": round(-cancelled_revenue, 2),
        "estimated_total_time_minutes": int(estimated_total_time_minutes),
        "route": route,
    }


def calculate_remaining_work_minutes(current_time_str: str) -> int:
    current_time = datetime.strptime(current_time_str, "%H:%M")
    end_time = current_time.replace(hour=18, minute=0)
    return max(0, int((end_time - current_time).total_seconds() // 60))


def fit_stops_to_budget(
    stops: list[dict],
    remaining_minutes: int,
    visit_duration_minutes: int,
) -> list[dict]:
    filtered = []
    budget_used = 0
    estimated_stop_minutes = visit_duration_minutes + 15

    for stop in stops:
        if stop.get("urgency_status") == "red":
            filtered.append(stop)
            budget_used += estimated_stop_minutes

    for stop in stops:
        if stop.get("urgency_status") == "red":
            continue
        if budget_used + estimated_stop_minutes > remaining_minutes:
            continue
        filtered.append(stop)
        budget_used += estimated_stop_minutes

    return filtered


def get_current_depot(
    current_route: dict,
    completed: list[dict],
    remaining: list[dict],
) -> tuple[float, float]:
    if completed:
        last_completed = max(completed, key=lambda stop: stop.get("order", 0))
        return last_completed["lat"], last_completed["lng"]

    if "current_lat" in current_route and "current_lng" in current_route:
        return current_route["current_lat"], current_route["current_lng"]

    if remaining:
        return remaining[0]["lat"], remaining[0]["lng"]

    return 0.0, 0.0


def optimize_remaining_stops(
    rep: dict,
    remaining: list[dict],
    depot_lat: float,
    depot_lng: float,
) -> list[dict]:
    if not remaining:
        return []

    locations = [
        {"store_id": 0, "lat": depot_lat, "lng": depot_lng},
        *[
            {
                "store_id": stop["store_id"],
                "lat": stop["lat"],
                "lng": stop["lng"],
            }
            for stop in remaining
        ],
    ]
    distance_matrix = compute_distance_matrix(locations)
    ordered_location_indices = solve_route(rep, locations, distance_matrix)

    if ordered_location_indices is None:
        return remaining

    stops_by_id = {stop["store_id"]: stop for stop in remaining}
    ordered = []
    for index in ordered_location_indices:
        if index == 0:
            continue
        store_id = locations[index]["store_id"]
        ordered.append(stops_by_id[store_id])

    return ordered


def rebuild_remaining_stops(
    rep: dict,
    remaining: list[dict],
    depot_lat: float,
    depot_lng: float,
    route_date: str,
    current_time_str: str,
) -> list[dict]:
    if not remaining:
        return []

    current_time = datetime.combine(
        date.fromisoformat(route_date),
        datetime.strptime(current_time_str, "%H:%M").time(),
    )
    speed_mps = (MUMBAI_AVG_SPEED_KMPH * 1000 / 3600) * rep["area_speed_factor"]
    previous_lat = depot_lat
    previous_lng = depot_lng
    rebuilt = []

    for stop in remaining:
        travel_seconds = haversine_distance(
            previous_lat,
            previous_lng,
            stop["lat"],
            stop["lng"],
        ) / speed_mps
        travel_time_minutes = round(travel_seconds / 60)
        current_time += timedelta(minutes=travel_time_minutes)

        updated_stop = stop.copy()
        updated_stop["planned_arrival"] = current_time.strftime("%H:%M")
        updated_stop["travel_time_minutes"] = travel_time_minutes
        updated_stop["visit_duration_minutes"] = rep["avg_visit_time_minutes"]
        updated_stop["status"] = "pending"
        rebuilt.append(updated_stop)

        current_time += timedelta(minutes=rep["avg_visit_time_minutes"])
        previous_lat = stop["lat"]
        previous_lng = stop["lng"]

    return rebuilt
