export interface SchedulerEnv {
  CMS_DB: D1Database;
}

/**
 * The deployment cron runs frequently and performs a guarded, idempotent
 * transition of due scheduled content. It contains no in-memory state.
 */
export default {
  async scheduled(_controller: ScheduledController, env: SchedulerEnv): Promise<void> {
    const now = new Date().toISOString();
    await env.CMS_DB.prepare(
      `UPDATE content_entries
       SET status = 'published', published_at = scheduled_at, updated_at = ?
       WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?`,
    )
      .bind(now, now)
      .run();
  },
};
