/**
 * Project metadata validation (Task 17).
 *
 * Two tiers, matching `_docs/plan.md`'s "Metadata is not versioned creative
 * state": a private save only needs metadata to be *structurally* sound
 * (non-blank title if given, tags within limits) — a brand-new project's
 * default "Untitled animation" / empty description are perfectly valid to
 * keep. The stronger "must actually say something" requirements only apply
 * when publishing or exporting (Task 49/55+ call validateProjectMetadataForPublish;
 * nothing calls it yet since neither of those endpoints exists).
 */

export type ProjectMetadataForValidation = {
  title?: string;
  description?: string;
  tags?: string[];
};

export const PLACEHOLDER_TITLE = 'Untitled animation';
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

export type FieldErrors = Record<string, string[]>;

export function validateProjectMetadataForPrivateSave(
  data: ProjectMetadataForValidation,
): FieldErrors {
  const errors: FieldErrors = {};

  if (data.title !== undefined && data.title.trim().length === 0) {
    errors.title = ['Title cannot be blank.'];
  }

  if (data.tags) {
    const tagErrors: string[] = [];
    if (data.tags.length > MAX_TAGS) {
      tagErrors.push(`No more than ${MAX_TAGS} tags are allowed.`);
    }
    if (data.tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
      tagErrors.push(`Each tag must be ${MAX_TAG_LENGTH} characters or fewer.`);
    }
    if (tagErrors.length > 0) {
      errors.tags = tagErrors;
    }
  }

  return errors;
}

export function validateProjectMetadataForPublish(data: ProjectMetadataForValidation): FieldErrors {
  const errors = validateProjectMetadataForPrivateSave(data);

  const title = data.title?.trim() ?? '';
  if (title.length === 0 || title === PLACEHOLDER_TITLE) {
    errors.title = [
      ...(errors.title ?? []),
      'Choose a meaningful title before publishing or exporting.',
    ];
  }

  if ((data.description ?? '').trim().length === 0) {
    errors.description = ['Add a description before publishing or exporting.'];
  }

  return errors;
}
