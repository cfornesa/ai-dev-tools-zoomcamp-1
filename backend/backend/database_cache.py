"""Database cache backend with an atomic increment operation.

Django's stock ``DatabaseCache`` implements ``incr`` as a read followed by a
write. That is safe for a single process but loses updates when two production
workers increment the same quota key concurrently. This subclass keeps the
same cache table and serialization format while locking the row for the
duration of the increment transaction.
"""

import base64
import datetime
import pickle

from django.conf import settings
from django.core.cache.backends.base import DEFAULT_TIMEOUT
from django.core.cache.backends.db import DatabaseCache
from django.db import connections, router, transaction
from django.utils.timezone import now as tz_now


class AtomicDatabaseCache(DatabaseCache):
    """PostgreSQL-safe ``DatabaseCache`` whose ``incr`` is row-atomic."""

    def add(self, key, value, timeout=DEFAULT_TIMEOUT, version=None):
        """Serialize first-use initialization for a key on PostgreSQL.

        Django's ``DatabaseCache.add`` performs a read followed by an insert.
        Its ``DatabaseError`` handling preserves the boolean cache contract,
        but concurrent workers still make PostgreSQL log a unique-key error
        for every losing initializer. These cache keys are used to seed
        shared quota counters immediately before ``incr``; serialize only
        that key's initialization so the loser observes the existing row
        without generating a database error or slowing unrelated keys.
        """
        db = router.db_for_write(self.cache_model_class)
        connection = connections[db]
        if connection.vendor != "postgresql":
            return super().add(key, value, timeout=timeout, version=version)

        normalized_key = self.make_and_validate_key(key, version=version)
        timeout = self.get_backend_timeout(timeout)
        now = tz_now().replace(microsecond=0)
        if timeout is None:
            expires = datetime.datetime.max
        else:
            tz = datetime.UTC if settings.USE_TZ else None
            expires = datetime.datetime.fromtimestamp(timeout, tz=tz)
        expires = expires.replace(microsecond=0)
        expires = connection.ops.adapt_datetimefield_value(expires)
        encoded = base64.b64encode(pickle.dumps(value, self.pickle_protocol)).decode("latin1")
        quote_name = connection.ops.quote_name
        table = quote_name(self._table)

        with transaction.atomic(using=db):
            with connection.cursor() as cursor:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                if count > self._max_entries:
                    self._cull(db, cursor, now, count)
                cursor.execute(
                    f"INSERT INTO {table} AS cache_row "
                    f"({quote_name('cache_key')}, {quote_name('value')}, "
                    f"{quote_name('expires')}) VALUES (%s, %s, %s) "
                    "ON CONFLICT (cache_key) DO UPDATE SET "
                    f"{quote_name('value')} = EXCLUDED.{quote_name('value')}, "
                    f"{quote_name('expires')} = EXCLUDED.{quote_name('expires')} "
                    f"WHERE cache_row.{quote_name('expires')} < %s",
                    [normalized_key, encoded, expires, now],
                )
                return cursor.rowcount > 0

    def incr(self, key, delta=1, version=None):
        original_key = key
        key = self.make_and_validate_key(key, version=version)
        db = router.db_for_write(self.cache_model_class)
        connection = connections[db]
        if not connection.features.has_select_for_update:
            # SQLite is intentionally used by the offline test suite and
            # does not support FOR UPDATE. Production selects PostgreSQL,
            # where the row lock below is the required cross-worker path.
            return super().incr(original_key, delta=delta, version=version)
        quote_name = connection.ops.quote_name
        table = quote_name(self._table)

        with transaction.atomic(using=db):
            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT {quote_name('value')}, {quote_name('expires')} "
                    f"FROM {table} WHERE {quote_name('cache_key')} = %s FOR UPDATE",
                    [key],
                )
                row = cursor.fetchone()
                if row is None:
                    raise ValueError(f"Key '{key}' not found")

                value, expires = row
                if expires < tz_now():
                    raise ValueError(f"Key '{key}' has expired")
                value = connection.ops.process_clob(value)
                value = pickle.loads(base64.b64decode(value.encode(), validate=True))
                if not isinstance(value, int):
                    raise ValueError(f"Key '{key}' does not contain an integer")

                new_value = value + delta
                encoded = base64.b64encode(pickle.dumps(new_value, self.pickle_protocol)).decode(
                    "latin1"
                )
                cursor.execute(
                    f"UPDATE {table} SET {quote_name('value')} = %s "
                    f"WHERE {quote_name('cache_key')} = %s",
                    [encoded, key],
                )
                return new_value
