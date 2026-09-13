import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("scenes", "0046_plan_pricing"),
    ]

    operations = [
        migrations.CreateModel(
            name="Page",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("slug", models.SlugField(max_length=120, unique=True)),
                ("description", models.TextField(blank=True, default="", max_length=5000)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("published", "Published")], default="draft", max_length=16)),
                ("nav_label", models.CharField(blank=True, default="", max_length=100)),
                ("show_in_nav", models.BooleanField(default=False)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("system_key", models.CharField(blank=True, max_length=64, null=True, unique=True)),
                ("revision", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("author", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="cms_pages", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="updated_cms_pages", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["sort_order", "title", "id"]},
        ),
        migrations.CreateModel(
            name="PageSlugRedirect",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("old_slug", models.SlugField(max_length=120, unique=True)),
                ("system_key", models.CharField(blank=True, default="", max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("page", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="slug_redirects", to="scenes.page")),
            ],
        ),
        migrations.CreateModel(
            name="PageAuditEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(max_length=32)),
                ("detail", models.CharField(blank=True, default="", max_length=200)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="cms_page_audit_events", to=settings.AUTH_USER_MODEL)),
                ("page", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="audit_events", to="scenes.page")),
            ],
        ),
        migrations.AddConstraint(
            model_name="page",
            constraint=models.CheckConstraint(condition=~models.Q(("system_key", "")), name="page_system_key_not_empty"),
        ),
    ]
