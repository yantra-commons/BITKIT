import { defineComponent, h, type Component, type PropType } from 'vue';

/**
 * Build a Vue component around a custom element. Props are always set as DOM properties (so
 * bigints, arrays and adapter objects pass through intact); custom events are re-emitted with
 * Vue-style names, e.g. `ou-paid` → `@paid`, `ou-status-change` → `@status-change`.
 */
export function wrap(
  tag: string,
  props: string[],
  events: Record<string, string>,
): Component<Record<string, unknown>> {
  return defineComponent({
    name: tag
      .replace(/^ou-/, '')
      .split('-')
      .map((p) => p[0]!.toUpperCase() + p.slice(1))
      .join(''),
    inheritAttrs: false,
    props: Object.fromEntries(
      props.map((p) => [p, { type: null as unknown as PropType<unknown>, default: undefined }]),
    ),
    emits: Object.keys(events),
    setup(p, { attrs, slots, emit }) {
      return () => {
        const data: Record<string, unknown> = { ...attrs };
        for (const key of props) {
          const v = (p as Record<string, unknown>)[key];
          if (v !== undefined) data[`.${key}`] = v; // force DOM property
        }
        for (const [vueName, domName] of Object.entries(events)) {
          const handler = `on${domName.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase())}`;
          data[handler] = (e: Event) => emit(vueName, e);
        }
        return h(tag, data, slots.default?.());
      };
    },
  });
}

/** Vue compiler option so templates treat `ou-*` tags as custom elements. */
export const isCustomElement = (tag: string) => tag.startsWith('ou-');
