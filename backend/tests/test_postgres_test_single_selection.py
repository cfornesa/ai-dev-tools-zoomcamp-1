"""Regression coverage for issue #502.

A PostgreSQL-backed test selected alone (`pytest path::test_name`) must set
up its database instead of failing with `ImproperlyConfigured: Circular
dependency in TEST[DEPENDENCIES]`. The subprocess is the assertion: the
exact repro command from the issue must exit 0 under single-test selection.
"""

import os
import subprocess
import sys

import pytest
from django.conf import settings

pytestmark = pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping PostgreSQL-backed tests.",
)

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


def test_postgres_test_runs_under_single_test_selection() -> None:
    completed = subprocess.run(
        _REPRO,
        capture_output=True,
        text=True,
        timeout=300,
        env=os.environ.copy(),
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
