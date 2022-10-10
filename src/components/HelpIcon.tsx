type HelpIconProps = {
  title?: string;
  name?: string;
  id?: string;
  onClick?(): void;
};

export const HelpIcon = (props: HelpIconProps) => (
  <button
    className="help-icon"
    onClick={props.onClick}
    type="button"
    title={`${props.title} — ?`}
    aria-label={props.title}
  >
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM8 11.333v.009"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 9a1 1 0 0 1 .667-1 1.733 1.733 0 1 0-2-2.667"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
);
