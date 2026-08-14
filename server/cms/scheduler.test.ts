import { describe, expect, it, vi } from "vitest";
import scheduler from "../../workers/scheduler";

describe("scheduled publication worker", () => {
  it("uses one guarded, idempotent D1 update for due scheduled entries", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });

    await scheduler.scheduled({} as ScheduledController, { CMS_DB: { prepare } as unknown as D1Database });

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?"));
    expect(bind).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
