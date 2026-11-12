import type { PropertyDeclarations } from 'lit';
import { OrangeElement, nextId } from './base.js';

/**
 * Base for form-associated inputs: wires ElementInternals so the element participates in
 * <form> submission, validation and reset, and provides label/help/error ids.
 */
export class FormControlElement extends OrangeElement {
  static formAssociated = true;
  static override shadowRootOptions = { ...OrangeElement.shadowRootOptions, delegatesFocus: true };

  static override properties: PropertyDeclarations = {
    name: { type: String },
    label: { type: String },
    helpText: { type: String, attribute: 'help-text' },
    error: { type: String },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    invalid: { type: Boolean, reflect: true },
  };

  /** Form field name. */
  declare name: string | undefined;
  /** Visible label. */
  declare label: string | undefined;
  /** Help text shown under the field. */
  declare helpText: string | undefined;
  /** Error message (sets the field invalid). */
  declare error: string | undefined;
  declare disabled: boolean;
  declare required: boolean;
  /** Reflects whether the field currently shows an error. */
  declare invalid: boolean;

  protected internals?: ElementInternals;
  protected readonly ids = { control: nextId('ctl'), help: nextId('help'), error: nextId('err') };

  constructor() {
    super();
    this.disabled = false;
    this.required = false;
    this.invalid = false;
    if (typeof this.attachInternals === 'function') {
      try {
        this.internals = this.attachInternals();
      } catch {
        /* environment without form association */
      }
    }
  }

  /** The owning form, if any. */
  get form(): HTMLFormElement | null {
    return this.internals?.form ?? null;
  }

  protected setFormValue(value: string | null): void {
    try {
      this.internals?.setFormValue?.(value);
    } catch {
      /* ignore */
    }
  }

  protected setValidity(message: string | undefined, anchor?: HTMLElement | null): void {
    try {
      if (message)
        this.internals?.setValidity?.({ customError: true }, message, anchor ?? undefined);
      else this.internals?.setValidity?.({});
    } catch {
      /* ignore */
    }
  }

  checkValidity(): boolean {
    return this.internals?.checkValidity?.() ?? !this.invalid;
  }

  reportValidity(): boolean {
    return this.internals?.reportValidity?.() ?? !this.invalid;
  }

  /** ids for aria-describedby: help + error when present. */
  protected describedBy(hasError: boolean): string | undefined {
    const ids = [this.helpText ? this.ids.help : '', hasError ? this.ids.error : ''].filter(
      Boolean,
    );
    return ids.length ? ids.join(' ') : undefined;
  }
}
