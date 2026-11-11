import manifest from '@bitkit-ui/elements/custom-elements.json';

interface CemType {
  text?: string;
}
export interface CemAttribute {
  name: string;
  fieldName?: string;
  description?: string;
  type?: CemType;
  default?: string;
  inheritedFrom?: { name: string };
}
export interface CemMember {
  kind: 'field' | 'method';
  name: string;
  description?: string;
  type?: CemType;
  default?: string;
  privacy?: string;
  static?: boolean;
  readonly?: boolean;
  parameters?: { name: string; type?: CemType }[];
  return?: { type?: CemType };
}
export interface CemNamed {
  name: string;
  description?: string;
  type?: CemType;
  default?: string;
}
export interface ComponentDoc {
  tag: string;
  slug: string;
  name: string;
  className: string;
  summary: string;
  description: string;
  attributes: CemAttribute[];
  properties: CemMember[];
  methods: CemMember[];
  events: CemNamed[];
  slots: CemNamed[];
  cssParts: CemNamed[];
  cssProperties: CemNamed[];
  security: boolean;
}

const pascal = (s: string) =>
  s
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');

type Decl = Record<string, unknown> & { tagName?: string; customElement?: boolean; name: string };

export const components: ComponentDoc[] = (
  manifest as { modules: { declarations?: Decl[] }[] }
).modules
  .flatMap((m) => m.declarations ?? [])
  .filter((d): d is Decl & { tagName: string } => Boolean(d.tagName && d.customElement))
  .map((d) => {
    const slug = d.tagName.replace(/^bk-/, '');
    const members = ((d.members as CemMember[]) ?? []).filter(
      (m) => !m.static && !m.name.startsWith('_') && !m.privacy,
    );
    // Prose only: drop fenced code examples that live in JSDoc summaries.
    const summary = String(d.summary ?? '')
      .split('```')[0]!
      .split(/[\s]+/)
      .join(' ')
      .trim();
    return {
      tag: d.tagName,
      slug,
      name: pascal(slug),
      className: d.name,
      summary,
      description: String(d.description ?? '').trim(),
      attributes: ((d.attributes as CemAttribute[]) ?? []).filter((a) => !a.name.startsWith('_')),
      properties: members.filter((m) => m.kind === 'field' && !m.readonly),
      methods: members.filter(
        (m) =>
          m.kind === 'method' &&
          ![
            'render',
            'connectedCallback',
            'disconnectedCallback',
            'updated',
            'willUpdate',
            'firstUpdated',
            'formResetCallback',
            'checkValidity',
            'reportValidity',
            'focus',
            'click',
          ].includes(m.name),
      ),
      events: ((d.events as CemNamed[]) ?? []).filter((e) => e.name),
      slots: (d.slots as CemNamed[]) ?? [],
      cssParts: (d.cssParts as CemNamed[]) ?? [],
      cssProperties: (d.cssProperties as CemNamed[]) ?? [],
      security: summary.startsWith('SECURITY-SENSITIVE'),
    };
  })
  .sort((a, b) => a.tag.localeCompare(b.tag));

export const componentBySlug = (slug: string) => components.find((c) => c.slug === slug);
