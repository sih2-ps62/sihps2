# OWNER: Param
# Evaluated on GET /emergency and GET /dashboard/summary
# if incident.status == "open" and (now - incident.timestamp) > timedelta(hours=2):
#     incident.severity = next_level(incident.severity)  # low->medium->high
#     incident.escalated_at = now
