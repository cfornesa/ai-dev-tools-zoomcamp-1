"""Owner-only, on-demand continuity aggregates for issue #1143."""

from __future__ import annotations

from django.db import DatabaseError, connection, transaction

from scenes.models import AIRun, Project, ProjectActivity

COHORT_MIN_OWNERS = 5
STATEMENT_TIMEOUT_MS = 5000


class ContinuityMetricsTimeoutError(Exception):
    """Raised when PostgreSQL cancels the bounded aggregate query."""


def _was_statement_timeout(error: DatabaseError) -> bool:
    cause = error.__cause__
    return (
        getattr(cause, "pgcode", None) == "57014"
        or getattr(cause, "sqlstate", None) == "57014"
        or getattr(getattr(cause, "diag", None), "sqlstate", None) == "57014"
    )


def _aggregate_sql() -> str:
    project = connection.ops.quote_name(Project._meta.db_table)
    run = connection.ops.quote_name(AIRun._meta.db_table)
    activity = connection.ops.quote_name(ProjectActivity._meta.db_table)
    if connection.vendor == "sqlite":
        duration = "((julianday(first_accepted_at) - julianday(first_run_at)) * 86400.0)"
    else:
        duration = "EXTRACT(EPOCH FROM (first_accepted_at - first_run_at))"

    return f"""
        WITH ranked_projects AS (
            SELECT id, owner_id,
                   ROW_NUMBER() OVER (
                       PARTITION BY owner_id ORDER BY created_at ASC, id ASC
                   ) AS project_position
            FROM {project}
        ), selected_projects AS (
            SELECT id, owner_id, project_position
            FROM ranked_projects
            WHERE project_position <= 3
        ), run_rollup AS (
            SELECT project_id,
                   COUNT(*) FILTER (WHERE status IN ('awaiting_review', 'accepted'))
                       AS reviewable_run_count,
                   COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_count,
                   MIN(created_at) AS first_run_at
            FROM {run}
            INNER JOIN selected_projects ON selected_projects.id = {run}.project_id
            WHERE {run}.target_type = 'project'
            GROUP BY {run}.project_id
        ), activity_rollup AS (
            SELECT project_id,
                   COUNT(*) FILTER (WHERE action_type = 'ai_proposal_rejected')
                       AS rejected_count,
                   MIN(created_at) FILTER (WHERE action_type = 'ai_proposal_accepted')
                       AS first_accepted_at
            FROM {activity}
            INNER JOIN selected_projects ON selected_projects.id = {activity}.project_id
            WHERE {activity}.action_type IN ('ai_proposal_accepted', 'ai_proposal_rejected')
            GROUP BY {activity}.project_id
        ), project_metrics AS (
            SELECT selected_projects.owner_id,
                   selected_projects.project_position,
                   COALESCE(run_rollup.reviewable_run_count, 0)
                       + COALESCE(activity_rollup.rejected_count, 0) AS proposal_count,
                   COALESCE(run_rollup.accepted_count, 0) AS accepted_count,
                   run_rollup.first_run_at,
                   activity_rollup.first_accepted_at
            FROM selected_projects
            LEFT JOIN run_rollup ON run_rollup.project_id = selected_projects.id
            LEFT JOIN activity_rollup ON activity_rollup.project_id = selected_projects.id
        ), duration_rows AS (
            SELECT project_position, {duration} AS duration_seconds
            FROM project_metrics
            WHERE first_run_at IS NOT NULL AND first_accepted_at IS NOT NULL
        ), ranked_durations AS (
            SELECT project_position, duration_seconds,
                   ROW_NUMBER() OVER (
                       PARTITION BY project_position ORDER BY duration_seconds
                   ) AS duration_rank,
                   COUNT(*) OVER (PARTITION BY project_position) AS duration_count
            FROM duration_rows
        ), medians AS (
            SELECT project_position, AVG(duration_seconds) AS median_seconds
            FROM ranked_durations
            WHERE duration_rank IN ((duration_count + 1) / 2, (duration_count + 2) / 2)
            GROUP BY project_position
        ), cohort_rollup AS (
            SELECT project_position,
                   COUNT(DISTINCT owner_id) AS owner_count,
                   AVG(proposal_count * 1.0) AS proposals_per_project,
                   SUM(accepted_count) * 1.0 / NULLIF(SUM(proposal_count), 0)
                       AS accepted_share
            FROM project_metrics
            GROUP BY project_position
        )
        SELECT cohort_rollup.project_position, cohort_rollup.owner_count,
               cohort_rollup.proposals_per_project, cohort_rollup.accepted_share,
               medians.median_seconds
        FROM cohort_rollup
        LEFT JOIN medians USING (project_position)
        ORDER BY cohort_rollup.project_position
    """


def get_continuity_metrics() -> dict[str, list[dict[str, object]]]:
    """Return aggregate cohorts without loading per-user or per-project rows."""
    try:
        with transaction.atomic():
            with connection.cursor() as cursor:
                if connection.vendor == "postgresql":
                    cursor.execute(
                        "SELECT set_config('statement_timeout', %s, true)",
                        [f"{STATEMENT_TIMEOUT_MS}ms"],
                    )
                cursor.execute(_aggregate_sql())
                rows = cursor.fetchall()
    except DatabaseError as error:
        if connection.vendor == "postgresql" and _was_statement_timeout(error):
            raise ContinuityMetricsTimeoutError from error
        raise

    by_position = {row[0]: row[1:] for row in rows}
    cohorts: list[dict[str, object]] = []
    for position in (1, 2, 3):
        row = by_position.get(position)
        if row is None:
            cohorts.append({"project_position": position, "suppressed": True, "metrics": None})
            continue
        owner_count = int(row[0])
        if owner_count < COHORT_MIN_OWNERS:
            cohorts.append({"project_position": position, "suppressed": True, "metrics": None})
            continue
        proposals, accepted_share, median_seconds = row[1:]
        cohorts.append(
            {
                "project_position": position,
                "suppressed": False,
                "metrics": {
                    "proposals_per_project": float(proposals or 0),
                    "accepted_share": float(accepted_share) if accepted_share is not None else None,
                    "median_time_to_accept_seconds": (
                        float(median_seconds) if median_seconds is not None else None
                    ),
                },
            }
        )
    return {"cohorts": cohorts}
