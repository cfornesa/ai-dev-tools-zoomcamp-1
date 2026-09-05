from django.core.cache import cache
from django.test import TestCase, override_settings

from scenes.ai_api import _increment_quota as increment_scene_quota
from scenes.ai_api3d import _increment_quota as increment_scene3d_quota
from scenes.art_piece_api import _increment_quota as increment_art_quota


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

    def test_all_ai_quota_paths_use_atomic_increments(self):
        self.assertEqual(increment_scene_quota("ai-quota:2d", timeout=60), 1)
        self.assertEqual(increment_scene_quota("ai-quota:2d", timeout=60), 2)
        self.assertEqual(increment_scene3d_quota("ai-quota:3d", timeout=60), 1)
        self.assertEqual(increment_scene3d_quota("ai-quota:3d", timeout=60), 2)
        self.assertEqual(increment_art_quota("ai-quota:art", timeout=60), 1)
        self.assertEqual(increment_art_quota("ai-quota:art", timeout=60), 2)
