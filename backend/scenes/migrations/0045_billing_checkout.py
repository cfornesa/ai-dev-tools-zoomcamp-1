from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("scenes", "0044_rename_site_brand")]

    operations = [
        migrations.AlterField(
            model_name="subscription",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("active", "Active"),
                    ("past_due", "Past due"),
                    ("cancelled", "Cancelled"),
                    ("suspended", "Suspended"),
                    ("expired", "Expired"),
                ],
                default="active",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="BillingCheckout",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("idempotency_key", models.CharField(max_length=128)),
                ("plan_key", models.CharField(max_length=32)),
                ("paypal_subscription_id", models.CharField(blank=True, default="", max_length=64)),
                ("approval_url", models.URLField(blank=True, default="", max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="billing_checkouts", to="auth.user")),
            ],
        ),
        migrations.AddConstraint(
            model_name="billingcheckout",
            constraint=models.UniqueConstraint(
                fields=("user", "idempotency_key"), name="unique_billing_checkout_key"
            ),
        ),
    ]
