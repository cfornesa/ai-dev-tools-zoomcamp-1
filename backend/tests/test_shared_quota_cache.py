from django.core.cache import cache
from django.test import TestCase, override_settings


@override_settings(
    CACHES={
        "default": {
            "BACKEND": "django.core.cache.backends.db.DatabaseCache",
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
