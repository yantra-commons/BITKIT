import type { PaymentAdapter } from '@bitkit-ui/adapters';

type Factory = () => PaymentAdapter;
const registry = new Map<string, Factory>();
const instances = new Map<string, PaymentAdapter>();

/**
 * Register a named adapter so components can reference it by attribute, e.g.
 * `<bk-pay-button adapter="store">`. The CDN build registers `mock` automatically.
 */
export function registerAdapter(name: string, adapter: PaymentAdapter | Factory): void {
  registry.set(name, typeof adapter === 'function' ? adapter : () => adapter);
  instances.delete(name);
}

/** Resolve an adapter property that may be an instance or a registered name. */
export function resolveAdapter(
  value: PaymentAdapter | string | undefined | null,
): PaymentAdapter | undefined {
  if (!value) return undefined;
  if (typeof value !== 'string') return value;
  let inst = instances.get(value);
  if (!inst) {
    const f = registry.get(value);
    if (!f) return undefined;
    inst = f();
    instances.set(value, inst);
  }
  return inst;
}
