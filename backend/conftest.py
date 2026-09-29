# Test setup: point the app at a throwaway SQLite file *before* db.py is imported, reseed per test.
import atexit
import os
import shutil
import tempfile

_tmp = tempfile.mkdtemp(prefix="polarops-test-")
atexit.register(shutil.rmtree, _tmp, ignore_errors=True)
os.environ["POLAROPS_DB_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["POLAROPS_SKIP_DOTENV"] = "1"  # a developer's backend/.env must not change what the tests see
for _knob in ("GEMINI_API_KEY", "POLAROPS_ESCALATION_HOURS", "POLAROPS_OVERDUE_HOURS", "POLAROPS_UI_OVERDUE_HOURS",
              "POLAROPS_CORS_ORIGINS", "POLAROPS_JWT_SECRET", "JWT_SECRET"):
    os.environ.pop(_knob, None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_login_throttle():
    from ui_api.throttle import login_throttle

    login_throttle.clear()


@pytest.fixture()
def client():
    import seed
    from main import app

    seed.seed(profile="plan")
    with TestClient(app) as test_client:
        yield test_client


def _sign_in(test_client, email, password):
    token = test_client.post("/api/auth/login", json={"email": email, "password": password}).json()["token"]
    test_client.headers["Authorization"] = f"Bearer {token}"
    return test_client


@pytest.fixture()
def admin():
    """The frontend API on the demo dataset, signed in as the admin."""
    import seed
    from main import app

    seed.seed(profile="demo")
    with TestClient(app) as test_client:
        yield _sign_in(test_client, "admin@polarops.io", "admin123")


@pytest.fixture()
def officer(admin):
    """A second client on the same database, signed in as the duty officer (no delete rights)."""
    from main import app

    return _sign_in(TestClient(app), "duty.officer@polarops.io", "demo123")


@pytest.fixture()
def anonymous(admin):
    from main import app

    return TestClient(app)


@pytest.fixture()
def session():
    from db import SessionLocal

    with SessionLocal() as db:
        yield db
