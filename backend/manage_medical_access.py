"""Deployment-owner CLI. Medical permission cannot be self-granted through the admin API."""
import argparse
from sqlalchemy import select
from db import SessionLocal, init_db
from models.safety import MedicalPermission
from models.user import User
from ui_api.common import record_audit
from ui_api.security import Principal, hash_password


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["grant", "revoke", "demo-medic"])
    parser.add_argument("--email")
    args = parser.parse_args()
    if args.action != "demo-medic" and not args.email:
        parser.error("--email is required for grant/revoke")
    init_db()
    with SessionLocal() as db:
        email = "medic@polarops.io" if args.action == "demo-medic" else args.email.strip().lower()
        account = db.scalars(select(User).where(User.email == email)).first()
        if account is None and args.action == "demo-medic":
            account = User(email=email, name="Demo Medical Officer", role="duty_officer",
                           password_hash=hash_password("polarmedic26"))
            db.add(account)
            db.flush()
        if account is None:
            parser.error("Account not found. Create the account through your deployment process first.")
        permission = db.get(MedicalPermission, account.id)
        if args.action == "revoke" and permission:
            db.delete(permission)
        elif args.action != "revoke" and not permission:
            db.add(MedicalPermission(user_id=account.id))
        actor = Principal(id=account.id, email=email, name="Deployment owner (local CLI)", role="provisioner")
        record_audit(db, actor, "medical_permission", "user", str(account.id), f"Medical permission {args.action}: {email}")
        db.commit()
        print(f"Medical permission {args.action}: {email}. Operational records preserved.")


if __name__ == "__main__":
    main()
