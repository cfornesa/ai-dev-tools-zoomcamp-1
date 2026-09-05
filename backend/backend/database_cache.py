"""Database cache backend with an atomic increment operation.

Django's stock ``DatabaseCache`` implements ``incr`` as a read followed by a
write. That is safe for a single process but loses updates when two production
workers increment the same quota key concurrently. This subclass keeps the
same cache table and serialization format while locking the row for the
duration of the increment transaction.
"""

import base64
import pickle

from django.core.cache.backends.db import DatabaseCache
from django.db import connections, router, transaction
from django.utils.timezone import now as tz_now


class AtomicDatabaseCache(DatabaseCache):
    """PostgreSQL-safe ``DatabaseCache`` whose ``incr`` is row-atomic."""

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
                encoded = base64.b64encode(
                    pickle.dumps(new_value, self.pickle_protocol)
                ).decode("latin1")
                cursor.execute(
                    f"UPDATE {table} SET {quote_name('value')} = %s "
                    f"WHERE {quote_name('cache_key')} = %s",
                    [encoded, key],
                )
                return new_value
