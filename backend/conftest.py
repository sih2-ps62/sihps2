# Test setup: point the app at a throwaway SQLite file *before* db.py is imported, reseed per test.
import atexit
import os
import shutil
import tempfile

_tmp = tempfile.mkdtemp(prefix="polarops-test-")
atexit.register(shutil.rmtree, _tmp, ignore_errors=True)
os.environ["POLAROPS_DB_URL"] = f"sqlite:///{_tmp}/test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture()
def client():
    import seed
    from main import app

    seed.seed()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def session():
    from db import SessionLocal

    with SessionLocal() as db:
        yield db
