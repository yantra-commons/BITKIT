import { css } from 'lit';

/** Base styles shared by every component. */
export const baseStyles = css`
  :host {
    box-sizing: border-box;
    font-family: var(--bk-font-sans);
    color: var(--bk-color-text);
    line-height: var(--bk-line-height-normal);
    -webkit-tap-highlight-color: transparent;
  }
  :host([hidden]) {
    display: none !important;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  .sr-only {
    position: absolute !important;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  :focus {
    outline: none;
  }
  :focus-visible {
    outline: none;
    box-shadow: var(--bk-focus-ring);
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  @media (forced-colors: active) {
    :focus-visible {
      outline: 2px solid CanvasText;
    }
  }
`;

/** Shared styles for labelled form fields (input, select, amount-input, address-input). */
export const fieldStyles = css`
  :host {
    display: block;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--bk-space-1);
  }
  label,
  .label {
    font-size: var(--bk-font-size-sm);
    font-weight: var(--bk-font-weight-medium);
    color: var(--bk-color-text);
  }
  .required {
    color: var(--bk-color-danger);
    margin-inline-start: 2px;
  }
  .control {
    display: flex;
    align-items: center;
    gap: var(--bk-space-2);
    min-height: var(--bk-control-height-lg);
    padding-inline: var(--bk-space-3);
    background: var(--bk-color-surface);
    border: 1px solid var(--bk-color-border-strong);
    border-radius: var(--bk-radius-md);
    transition:
      border-color var(--bk-duration-fast) var(--bk-easing-standard),
      box-shadow var(--bk-duration-fast) var(--bk-easing-standard);
  }
  .control:focus-within {
    border-color: var(--bk-color-focus);
    box-shadow: 0 0 0 1px var(--bk-color-focus);
  }
  :host([invalid]) .control,
  .control.invalid {
    border-color: var(--bk-color-danger);
  }
  :host([disabled]) .control {
    background: var(--bk-color-surface-2);
    cursor: not-allowed;
    opacity: 0.7;
  }
  input,
  select,
  textarea {
    flex: 1;
    min-width: 0;
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--bk-font-size-md);
    padding-block: var(--bk-space-2);
  }
  input:focus,
  select:focus,
  textarea:focus,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    outline: none;
    box-shadow: none;
  }
  input::placeholder,
  textarea::placeholder {
    color: var(--bk-color-text-muted);
    opacity: 1;
  }
  .mono {
    font-family: var(--bk-font-mono);
  }
  .help {
    font-size: var(--bk-font-size-sm);
    color: var(--bk-color-text-muted);
  }
  .error {
    display: flex;
    gap: var(--bk-space-1);
    align-items: flex-start;
    font-size: var(--bk-font-size-sm);
    color: var(--bk-color-danger);
  }
  .error bk-icon {
    flex: none;
    margin-top: 2px;
  }
`;
