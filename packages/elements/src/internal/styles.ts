import { css } from 'lit';

/** Base styles shared by every component. */
export const baseStyles = css`
  :host {
    box-sizing: border-box;
    font-family: var(--ou-font-sans);
    color: var(--ou-color-text);
    line-height: var(--ou-line-height-normal);
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
    box-shadow: var(--ou-focus-ring);
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
    gap: var(--ou-space-1);
  }
  label,
  .label {
    font-size: var(--ou-font-size-sm);
    font-weight: var(--ou-font-weight-medium);
    color: var(--ou-color-text);
  }
  .required {
    color: var(--ou-color-danger);
    margin-inline-start: 2px;
  }
  .control {
    display: flex;
    align-items: center;
    gap: var(--ou-space-2);
    min-height: var(--ou-control-height-lg);
    padding-inline: var(--ou-space-3);
    background: var(--ou-color-surface);
    border: 1px solid var(--ou-color-border-strong);
    border-radius: var(--ou-radius-md);
    transition:
      border-color var(--ou-duration-fast) var(--ou-easing-standard),
      box-shadow var(--ou-duration-fast) var(--ou-easing-standard);
  }
  .control:focus-within {
    border-color: var(--ou-color-focus);
    box-shadow: 0 0 0 1px var(--ou-color-focus);
  }
  :host([invalid]) .control,
  .control.invalid {
    border-color: var(--ou-color-danger);
  }
  :host([disabled]) .control {
    background: var(--ou-color-surface-2);
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
    font-size: var(--ou-font-size-md);
    padding-block: var(--ou-space-2);
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
    color: var(--ou-color-text-muted);
    opacity: 1;
  }
  .mono {
    font-family: var(--ou-font-mono);
  }
  .help {
    font-size: var(--ou-font-size-sm);
    color: var(--ou-color-text-muted);
  }
  .error {
    display: flex;
    gap: var(--ou-space-1);
    align-items: flex-start;
    font-size: var(--ou-font-size-sm);
    color: var(--ou-color-danger);
  }
  .error ou-icon {
    flex: none;
    margin-top: 2px;
  }
`;
