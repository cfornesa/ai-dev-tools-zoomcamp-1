from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("scenes", "0045_billing_checkout")]

    operations = [
        migrations.AddField(
            model_name="plan",
            name="price",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name="plan",
            name="currency",
            field=models.CharField(default="USD", max_length=3),
        ),
        migrations.AddField(
            model_name="plan",
            name="billing_interval",
            field=models.CharField(default="month", max_length=16),
        ),
    ]
