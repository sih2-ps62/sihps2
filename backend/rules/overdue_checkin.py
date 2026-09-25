# OWNER: Param
# Evaluated lazily on every GET /personnel
# if (now - personnel.last_checkin) > timedelta(hours=6) and personnel.status != "overdue":
#     personnel.status = "overdue"
