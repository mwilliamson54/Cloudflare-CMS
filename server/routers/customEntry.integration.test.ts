import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contentTypes } from "../../drizzle/schema";
import { createContentEntry, createCustomContentType, deleteContentEntry, getDb, updateContentEntry } from "../db";
import { cmsRouter } from "./cms";
import { siteRouter } from "./site";

let contentTypeId: number | undefined;
let entryId: number | undefined;
let contentTypeKey = "";
let slug = "";

describe("real repository custom-entry public visibility", () => {
  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    contentTypeKey = `lookbook-${suffix}`;
    slug = `autumn-study-${suffix}`;
    const type = await createCustomContentType({ key: contentTypeKey, label: `Integration lookbook ${suffix}`, fieldDefinitions: [{ key: "title", label: "Title", type: "text", required: true }] });
    contentTypeId = type?.id;
    if (!contentTypeId) throw new Error("Expected a persisted custom content type.");
  });

  afterEach(async () => {
    if (entryId) await deleteContentEntry(entryId);
    if (contentTypeId) {
      const db = await getDb();
      await db?.delete(contentTypes).where(eq(contentTypes.id, contentTypeId));
    }
    contentTypeId = undefined;
    entryId = undefined;
  });

  it("withholds a custom draft and exposes the same record after publication", async () => {
    const caller = siteRouter.createCaller({} as any);
    const draft = await createContentEntry({ contentTypeKey, authorId: 900_002, title: "Autumn study", slug, status: "draft", fieldData: { season: "autumn" } });
    entryId = draft?.id;
    expect(entryId).toBeTypeOf("number");

    await expect(caller.customEntry({ contentTypeKey, slug })).resolves.toBeNull();
    await updateContentEntry(entryId!, { status: "published" });
    await expect(caller.customEntry({ contentTypeKey, slug })).resolves.toMatchObject({ id: entryId, slug, status: "published", fieldData: { season: "autumn" } });
  });

  it("supports the complete custom-entry administration lifecycle while preserving public state isolation", async () => {
    const admin = cmsRouter.createCaller({ user: { id: 900_002, role: "admin" } } as any);
    const publicCaller = siteRouter.createCaller({} as any);
    const created = await admin.content.create({ contentTypeKey, title: "Scheduled lookbook", slug, status: "scheduled", scheduledAt: new Date(Date.now() + 60_000), fieldData: { season: "winter" } });
    entryId = created?.id;
    expect(entryId).toBeTypeOf("number");
    await expect(admin.content.get({ id: entryId! })).resolves.toMatchObject({ status: "scheduled", fieldData: { season: "winter" } });
    await expect(admin.content.list({ contentTypeKey, status: "scheduled" })).resolves.toMatchObject({ entries: [expect.objectContaining({ id: entryId, status: "scheduled" })] });
    await expect(publicCaller.customEntry({ contentTypeKey, slug })).resolves.toBeNull();

    await admin.content.update({ id: entryId!, values: { status: "published", title: "Published lookbook" } });
    await expect(publicCaller.customEntry({ contentTypeKey, slug })).resolves.toMatchObject({ id: entryId, title: "Published lookbook", status: "published" });

    await admin.content.update({ id: entryId!, values: { status: "archived" } });
    await expect(publicCaller.customEntry({ contentTypeKey, slug })).resolves.toBeNull();

    await admin.content.trash({ id: entryId! });
    await expect(admin.content.list({ contentTypeKey, trashed: true })).resolves.toMatchObject({ entries: [expect.objectContaining({ id: entryId })] });
    await admin.content.restore({ id: entryId! });
    await admin.content.delete({ id: entryId! });
    entryId = undefined;
    await expect(admin.content.get({ id: created!.id })).resolves.toBeNull();
  });
});
