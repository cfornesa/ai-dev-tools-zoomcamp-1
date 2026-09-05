from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("scenes", "0025_artpiece_artpieceversion_artpiecethumbnail_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE TABLE IF NOT EXISTS django_cache ("
                "cache_key varchar(255) NOT NULL PRIMARY KEY, "
                "value text NOT NULL, "
                "expires timestamp with time zone NOT NULL"
                ")"
            ),
            reverse_sql="DROP TABLE IF EXISTS django_cache",
        ),
        migrations.RunSQL(
            sql=(
                "CREATE INDEX IF NOT EXISTS django_cache_expires "
                "ON django_cache (expires)"
            ),
            reverse_sql="DROP INDEX IF EXISTS django_cache_expires",
        ),
    ]
