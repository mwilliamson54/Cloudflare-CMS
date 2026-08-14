export type CmsHookMap = {
  "post.public": { id: number; title: string; bodyMarkdown: string | null; readingTimeMinutes?: number };
  "post.created": { id: number; title: string };
  "post.updated": { id: number; title: string };
};

type HookName = keyof CmsHookMap;
type Filter<T> = (value: T) => T | Promise<T>;

class CmsHookBus {
  private filters = new Map<HookName, Filter<unknown>[]>();

  addFilter<T extends HookName>(hook: T, filter: Filter<CmsHookMap[T]>) {
    const current = this.filters.get(hook) ?? [];
    current.push(filter as Filter<unknown>);
    this.filters.set(hook, current);
  }

  async applyFilters<T extends HookName>(hook: T, value: CmsHookMap[T]): Promise<CmsHookMap[T]> {
    let result = value;
    for (const filter of this.filters.get(hook) ?? []) result = await (filter as Filter<CmsHookMap[T]>)(result);
    return result;
  }
}

export type CmsPlugin = {
  key: string;
  name: string;
  version: string;
  register: (hooks: CmsHookBus) => void;
};

export const cmsHooks = new CmsHookBus();
const installedPlugins = new Set<string>();

export function registerPlugin(plugin: CmsPlugin) {
  if (installedPlugins.has(plugin.key)) return;
  plugin.register(cmsHooks);
  installedPlugins.add(plugin.key);
}
