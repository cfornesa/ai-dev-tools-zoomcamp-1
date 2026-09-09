"""Regression coverage for issue #502.

A PostgreSQL-backed test selected alone (`pytest path::test_name`) must set
up its database instead of failing with `ImproperlyConfigured: Circular
dependency in TEST[DEPENDENCIES]`. The subprocess is the assertion: the
exact repro command from the issue must exit 0 under single-test selection.

The subprocess must NOT share the parent suite's derived test database:
both derive `test_<dbname>` from `POSTGRES_TEST_DATABASE_URL`, and mid-suite
the parent holds open session-scoped connections to it, so the subprocess's
create/teardown collides with the parent's ("already exists" / "is being
accessed by other users" / teardowns racing each other). The subprocess
therefore runs against its own suffixed database name, so its derived test
database is physically distinct and its own pytest-django teardown cleans
it up completely.
"""

import os
import subprocess
import sys
import urllib.parse

import pytest
from django.conf import settings

pytestmark = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)

_ISOLATION_SUFFIX = "-single-selection"

_REPRO = [
    sys.executable,
    "-m",
    "pytest",
    "tests/test_account_deletion.py::test_postgres_concurrent_deletion_requests_only_one_succeeds",
    "-q",
    "--no-header",
    "-p",
    "no:cacheprovider",
]


def _isolated_postgres_test_url() -> str:
    url = os.environ["POSTGRES_TEST_DATABASE_URL"]
    parts = urllib.parse.urlsplit(url)
    name = parts.path.lstrip("/")
    if not name.endswith(_ISOLATION_SUFFIX):
        name = f"{name}{_ISOLATION_SUFFIX}"
    return urllib.parse.urlunsplit(parts._replace(path=f"/{name}"))


def test_postgres_test_runs_under_single_test_selection() -> None:
    subprocess_env = os.environ.copy()
    subprocess_env["POSTGRES_TEST_DATABASE_URL"] = _isolated_postgres_test_url()
    completed = subprocess.run(
        _REPRO,
        capture_output=True,
        text=True,
        timeout=300,
        env=subprocess_env,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
