import multiprocessing
import os

import pytest
from django.conf import settings
from django.core.cache import cache
from django.db import close_old_connections, connections
from django.test import TestCase, override_settings

from scenes.ai_api import _increment_and_check, _quota_cache_key, _rate_limit_cache_key
from scenes.ai_api import _increment_quota as increment_scene_quota
from scenes.ai_api3d import _increment_quota as increment_scene3d_quota
from scenes.art_piece_api import _increment_quota as increment_art_quota


def _run_shared_quota_worker(rate_key, daily_key, gate, result_queue):
    """Increment the real configured cache from an independent worker process."""
    close_old_connections()
    gate.wait()
    try:
        rate_results = [
            _increment_and_check(rate_key, limit=5, window_seconds=60)
            for _ in range(3)
        ]
        daily_results = [increment_scene_quota(daily_key, timeout=3600) for _ in range(3)]
        result_queue.put((rate_results, daily_results))
    finally:
        close_old_connections()


postgres_cache_settings = override_settings(
    CACHES={
        "default": {
            "BACKEND": "backend.database_cache.AtomicDatabaseCache",
            "LOCATION": "django_cache",
            "TIMEOUT": None,
        }
    }
)


class _CacheOnPostgresRouter:
    def db_for_read(self, model, **hints):
        if model._meta.app_label == "django_cache":
            return "postgres_test"
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label == "django_cache":
            return "postgres_test"
        return None

    def allow_relation(self, obj1, obj2, **hints):
        return True


class _AllOnPostgresRouter(_CacheOnPostgresRouter):
    def db_for_read(self, model, **hints):
        return "postgres_test"

    def db_for_write(self, model, **hints):
        return "postgres_test"


def _rebind_default_to_postgres():
    """Give a forked API worker a fresh default connection to PostgreSQL."""
    connections["default"].close()
    try:
        delattr(connections._connections, "default")
    except AttributeError:
        pass
    connections.databases["default"] = dict(connections.databases["postgres_test"])


def _run_create_scene_worker(user_id, project_public_id, gate, result_queue):
    """Drive the real create-scene view from one independent worker."""
    os.environ["AI_PROVIDER"] = "fake"
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    _rebind_default_to_postgres()
    close_old_connections()
    gate.wait()
    try:
        user = get_user_model().objects.get(pk=user_id)
        client = APIClient()
        client.force_authenticate(user)
        responses = []
        for _ in range(3):
            response = client.post(
                f"/api/projects/{project_public_id}/ai/create-scene/",
                {"prompt": "a small blue circle"},
                format="json",
            )
            responses.append((response.status_code, response.json().get("error")))
        result_queue.put(responses)
    finally:
        close_old_connections()


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "backend.database_cache.AtomicDatabaseCache",
            "LOCATION": "django_cache",
            "TIMEOUT": None,
        }
    }
)
class SharedQuotaCacheTests(TestCase):
    def test_database_cache_round_trips_quota_state(self):
        cache.set("ai-quota:user:42:daily", 4)

        self.assertEqual(cache.get("ai-quota:user:42:daily"), 4)

    def test_database_cache_add_is_atomic_for_existing_quota_key(self):
        self.assertTrue(cache.add("ai-quota:user:42:window", 1, timeout=60))
        self.assertFalse(cache.add("ai-quota:user:42:window", 2, timeout=60))
        self.assertEqual(cache.get("ai-quota:user:42:window"), 1)

    def test_all_ai_quota_paths_use_atomic_increments(self):
        self.assertEqual(increment_scene_quota("ai-quota:2d", timeout=60), 1)
        self.assertEqual(increment_scene_quota("ai-quota:2d", timeout=60), 2)
        self.assertEqual(increment_scene3d_quota("ai-quota:3d", timeout=60), 1)
        self.assertEqual(increment_scene3d_quota("ai-quota:3d", timeout=60), 2)
        self.assertEqual(increment_art_quota("ai-quota:art", timeout=60), 1)
        self.assertEqual(increment_art_quota("ai-quota:art", timeout=60), 2)


@pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping multi-process PostgreSQL test.",
)
@pytest.mark.django_db(databases=["default", "postgres_test"], transaction=True)
@postgres_cache_settings
@override_settings(DATABASE_ROUTERS=[_CacheOnPostgresRouter()])
def test_two_worker_database_cache_enforces_rate_window_and_daily_counter():
    """Independent worker processes must share the same quota state.

    Six increments are deliberately split across two processes. The shared
    rate window accepts exactly five and rejects the sixth; the daily counter
    reaches six without lost updates. This is the deployment-specific proof
    that LocMemCache could never provide.
    """
    rate_key = "ai-quota:process-shared:rate"
    daily_key = "ai-quota:process-shared:daily"
    context = multiprocessing.get_context("fork")
    gate = context.Barrier(2)
    result_queue = context.Queue()
    workers = [
        context.Process(
            target=_run_shared_quota_worker,
            args=(rate_key, daily_key, gate, result_queue),
        )
        for _ in range(2)
    ]

    cache.delete(rate_key)
    cache.delete(daily_key)
    # Never let forked workers inherit a live psycopg socket from the parent.
    # Each worker must establish its own PostgreSQL connection.
    connections["postgres_test"].close()
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=30)
    connections["postgres_test"].close()

    assert all(worker.exitcode == 0 for worker in workers)
    results = [result_queue.get(timeout=5) for _ in workers]
    rate_results = [accepted for rates, _ in results for accepted in rates]
    daily_results = [count for _, daily in results for count in daily]

    assert len(rate_results) == 6
    assert sum(rate_results) == 5
    assert cache.get(rate_key) == 6
    assert cache.get(daily_key) == 6
    assert sorted(daily_results) == list(range(1, 7))


@pytest.mark.skipif(
    "postgres_test" not in settings.DATABASES,
    reason="POSTGRES_TEST_DATABASE_URL is not set; skipping multi-process API test.",
)
@pytest.mark.django_db(databases=["default", "postgres_test"], transaction=True)
@postgres_cache_settings
@override_settings(DATABASE_ROUTERS=[_AllOnPostgresRouter()])
def test_two_worker_api_clients_return_existing_429_on_sixth_request():
    """The actual create-scene endpoint enforces the shared worker limit."""
    from django.contrib.auth import get_user_model

    from scenes.models import Project

    user = get_user_model().objects.db_manager("postgres_test").create_user(
        username="process-api-quota-user"
    )
    project = Project.objects.using("postgres_test").create(owner=user)
    connections["postgres_test"].close()

    context = multiprocessing.get_context("fork")
    gate = context.Barrier(2)
    result_queue = context.Queue()
    workers = [
        context.Process(
            target=_run_create_scene_worker,
            args=(user.pk, project.public_id, gate, result_queue),
        )
        for _ in range(2)
    ]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=30)
    connections["postgres_test"].close()

    assert all(worker.exitcode == 0 for worker in workers)
    responses = [response for _ in workers for response in result_queue.get(timeout=5)]
    assert sorted(status for status, _ in responses) == [200, 200, 200, 200, 200, 429]
    assert [error for _, error in responses if error] == ["rate_limited"]
    assert cache.get(_rate_limit_cache_key(user.pk)) == 6
    assert cache.get(_quota_cache_key(user.pk)) == 5
