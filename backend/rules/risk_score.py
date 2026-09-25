# OWNER: Maisha
# Route Risk Score — called by GET /expeditions/{id}/risk
# risk += weather_severity[route.weather_code] * 30
# risk += min(route.waypoint_count * 5, 20)
# risk += 20 if any_overdue_personnel_on_route else 0
# risk += 10 if route.season == "winter" else 0
# risk_score = min(round(risk), 100)
# band = "low" if risk_score < 34 else "medium" if risk_score < 67 else "high"
