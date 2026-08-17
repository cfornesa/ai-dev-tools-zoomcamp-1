"""Catalog metadata for the eight built-in starter templates (Task 19).

Shared by the seeding migration (scenes/migrations/0010_seed_builtin_templates.py)
and its tests (tests/test_template_catalog.py) so the two never drift out
of sync. Each fixture file lives in scenes/fixtures/templates/.
"""

# (fixture filename, name, category, description/onboarding hint)
BUILT_IN_TEMPLATES = [
    (
        "blank_canvas.json",
        "Blank canvas",
        "Basics",
        "Start from an empty canvas, ready for your own shapes and gestures.",
    ),
    (
        "hand_follower.json",
        "Hand follower",
        "Gesture basics",
        "A single shape that follows your index fingertip across the canvas.",
    ),
    (
        "pinch_particle_burst.json",
        "Pinch particle burst",
        "Gesture basics",
        "Pinch to release a burst of particles from the center of the canvas.",
    ),
    (
        "open_palm_bloom.json",
        "Open-palm bloom",
        "Gesture basics",
        "Open your palm to bloom a cluster of shapes outward.",
    ),
    (
        "motion_trails.json",
        "Motion trails",
        "Motion",
        "A trailing dot that follows your fingertip, leaving a fading path behind it.",
    ),
    (
        "gesture_color_field.json",
        "Gesture color field",
        "Color",
        "A color field that shifts as your hands move and come together.",
    ),
    (
        "physics_orbit.json",
        "Physics orbit",
        "Physics",
        "Particles orbit a fixed core, nudged by the distance between your hands.",
    ),
    (
        "svg_kinetic_poster.json",
        "SVG kinetic poster",
        "Poster",
        "Bold poster-style strokes that tilt and fade in response to your gestures.",
    ),
]
