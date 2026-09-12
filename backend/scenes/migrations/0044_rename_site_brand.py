from django.db import migrations


def rename_site_brand(apps, schema_editor):
    SiteSettings = apps.get_model("scenes", "SiteSettings")
    SiteSettings.objects.filter(site_title__iexact="creatrart").update(site_title="AugmentrART")


class Migration(migrations.Migration):
    dependencies = [("scenes", "0043_seed_cloud_sync_entitlement")]
    operations = [migrations.RunPython(rename_site_brand, migrations.RunPython.noop)]
