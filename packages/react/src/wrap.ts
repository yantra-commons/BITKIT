'use client';
import * as React from 'react';

/** Props that always go to React as attributes / React-managed props. */
const REACT_PROPS = new Set([
  'children',
  'className',
  'style',
  'id',
  'slot',
  'key',
  'ref',
  'hidden',
  'title',
  'role',
  'tabIndex',
  'dir',
  'lang',
]);
const isAttr = (k: string) => REACT_PROPS.has(k) || k.startsWith('aria-') || k.startsWith('data-');

type EventProps<Ev extends string> = { [K in Ev]?: (event: CustomEvent) => void };

/** Public, non-method element properties, made optional (`_internal` state is excluded). */
type ElementProps<E> = Partial<{
  [
    K in keyof E as K extends `_${string}`
      ? never
      : E[K] extends (...args: never[]) => unknown
        ? never
        : K
  ]: E[K];
}>;

export type WrapperProps<E extends HTMLElement, Ev extends string> = Omit<
  ElementProps<E>,
  keyof HTMLElement
> &
  EventProps<Ev> &
  Omit<React.HTMLAttributes<HTMLElement>, Ev | 'onChange' | 'onInput' | 'onSelect'> & {
    children?: React.ReactNode;
  };

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

/**
 * Wrap a custom element for React 18 and 19. Element props are assigned as DOM properties
 * (bigints, arrays and adapter objects pass through intact) and custom events are mapped to
 * `on<Name>` props. Server rendering outputs the tag; properties apply on hydration.
 */
export function wrap<E extends HTMLElement, Ev extends string>(
  tag: string,
  events: Record<Ev, string>,
  displayName: string,
) {
  const Component = React.forwardRef<E, WrapperProps<E, Ev>>((props, forwarded) => {
    const ref = React.useRef<E | null>(null);
    const handlers = React.useRef<Partial<Record<Ev, (e: CustomEvent) => void>>>({});
    const reactProps: Record<string, unknown> = {};
    const elementProps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (k in events) handlers.current[k as Ev] = v as (e: CustomEvent) => void;
      else if (isAttr(k) || k.startsWith('on')) reactProps[k] = v;
      else elementProps[k] = v;
    }
    // Clear handlers that were removed since the last render.
    for (const k of Object.keys(handlers.current) as Ev[])
      if (!(k in props)) delete handlers.current[k];

    useIsoLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      for (const [k, v] of Object.entries(elementProps)) {
        if ((el as unknown as Record<string, unknown>)[k] !== v)
          (el as unknown as Record<string, unknown>)[k] = v;
      }
    });

    useIsoLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const listeners = (Object.entries(events) as [Ev, string][]).map(([prop, name]) => {
        const fn = (e: Event) => handlers.current[prop]?.(e as CustomEvent);
        el.addEventListener(name, fn);
        return [name, fn] as const;
      });
      return () => listeners.forEach(([name, fn]) => el.removeEventListener(name, fn));
    }, []);

    const setRef = (node: E | null) => {
      ref.current = node;
      if (typeof forwarded === 'function') forwarded(node);
      else if (forwarded) forwarded.current = node;
    };
    const { children } = props as { children?: React.ReactNode };
    return React.createElement(
      tag,
      { ...reactProps, ref: setRef, suppressHydrationWarning: true },
      children,
    );
  });
  Component.displayName = displayName;
  return Component;
}
