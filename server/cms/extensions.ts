export type CmsHookMap = {
  "post.public": { id: number; title: string; bodyMarkdown: string | null; readingTimeMinutes?: number };
  "post.created": { id: number; title: string };
  "post.updated": { id: number; title: string };
};

type HookName = keyof CmsHookMap;
type Filter<T> = (value: T) => T | Promise<T>;
export type CmsHookRegistrar = { addFilter<T extends HookName>(hook: T, filter: Filter<CmsHookMap[T]>): void };

class CmsHookBus {
  private filters = new Map<HookName, Array<{ pluginKey?: string; filter: Filter<unknown> }>>();

  addFilter<T extends HookName>(hook: T, filter: Filter<CmsHookMap[T]>, pluginKey?: string) {
    const current = this.filters.get(hook) ?? [];
    current.push({ filter: filter as Filter<unknown>, pluginKey });
    this.filters.set(hook, current);
  }

  registrar(pluginKey: string): CmsHookRegistrar {
    return { addFilter: (hook, filter) => this.addFilter(hook, filter, pluginKey) };
  }

  removePlugin(pluginKey: string) {
    Array.from(this.filters.entries()).forEach(([hook, filters]) => {
      this.filters.set(hook, filters.filter((item: { pluginKey?: string; filter: Filter<unknown> }) => item.pluginKey !== pluginKey));
    });
  }

  async applyFilters<T extends HookName>(hook: T, value: CmsHookMap[T]): Promise<CmsHookMap[T]> {
    let result = value;
    for (const item of this.filters.get(hook) ?? []) result = await (item.filter as Filter<CmsHookMap[T]>)(result);
    return result;
  }
}

export type CmsPlugin = {
  key: string;
  name: string;
  version: string;
  register: (hooks: CmsHookRegistrar) => void;
  unregister?: () => void;
};

export const cmsHooks = new CmsHookBus();
const installedPlugins = new Set<string>();
const pluginRecords = new Map<string, CmsPlugin>();

export function registerPlugin(plugin: CmsPlugin) {
  if (installedPlugins.has(plugin.key)) return;
  plugin.register(cmsHooks.registrar(plugin.key));
  installedPlugins.add(plugin.key);
  pluginRecords.set(plugin.key, plugin);
}

export function unregisterPlugin(pluginKey: string) {
  pluginRecords.get(pluginKey)?.unregister?.();
  cmsHooks.removePlugin(pluginKey);
  installedPlugins.delete(pluginKey);
  pluginRecords.delete(pluginKey);
}
