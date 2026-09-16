"""Stable title-derived public slugs for canonical piece URLs (#578)."""

from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils.text import slugify

from scenes.models import ArtPiece, Project, Project3D


def _next_slug(model, instance) -> str:
    base = slugify(instance.title)[:200] or "piece"
    candidate = base
    suffix = 2
    while (
        model.objects.filter(owner=instance.owner, public_slug=candidate)
        .exclude(pk=instance.pk)
        .exists()
    ):
        candidate = f"{base[: 220 - len(str(suffix)) - 1]}-{suffix}"
        suffix += 1
    return candidate


@receiver(pre_save, sender=Project)
@receiver(pre_save, sender=Project3D)
@receiver(pre_save, sender=ArtPiece)
def assign_public_slug(sender, instance, **kwargs):
    if not instance.public_slug:
        instance.public_slug = _next_slug(sender, instance)
