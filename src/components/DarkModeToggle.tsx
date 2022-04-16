import "./ToolIcon.scss";

import { t } from "../i18n";
import { ToolButton } from "./ToolButton";
import { THEME } from "../constants";
import { Theme } from "../element/types";

// Historically, this toggle was not supporting a system value, however
// now it might be renamed to something more appropriate.
export const DarkModeToggle = (props: {
  value: Theme;
  onChange: (value: Theme) => void;
  title?: string;
  withSystemTheme?: boolean;
}) => {
  const title = props.title || t("buttons.changeTheme");

  return (
    <ToolButton
      type="icon"
      icon={THEME_TO_ICON[props.value] ?? THEME.LIGHT}
      title={title}
      aria-label={title}
      onClick={() =>
        props.onChange(getNextTheme(props.value, props.withSystemTheme))
      }
      data-testid="toggle-dark-mode"
    />
  );
};

const getNextTheme = (previous: Theme, withSystemTheme = false) => {
  switch (previous) {
    case THEME.DARK:
      return withSystemTheme ? THEME.SYSTEM : THEME.LIGHT;
    case THEME.SYSTEM:
      return THEME.LIGHT;
    default:
      return THEME.DARK;
  }
};

const ICONS = {
  SUN: (
    <svg width="512" height="512" className="rtl-mirror" viewBox="0 0 512 512">
      <path
        fill="currentColor"
        d="M256 160c-52.9 0-96 43.1-96 96s43.1 96 96 96 96-43.1 96-96-43.1-96-96-96zm246.4 80.5l-94.7-47.3 33.5-100.4c4.5-13.6-8.4-26.5-21.9-21.9l-100.4 33.5-47.4-94.8c-6.4-12.8-24.6-12.8-31 0l-47.3 94.7L92.7 70.8c-13.6-4.5-26.5 8.4-21.9 21.9l33.5 100.4-94.7 47.4c-12.8 6.4-12.8 24.6 0 31l94.7 47.3-33.5 100.5c-4.5 13.6 8.4 26.5 21.9 21.9l100.4-33.5 47.3 94.7c6.4 12.8 24.6 12.8 31 0l47.3-94.7 100.4 33.5c13.6 4.5 26.5-8.4 21.9-21.9l-33.5-100.4 94.7-47.3c13-6.5 13-24.7.2-31.1zm-155.9 106c-49.9 49.9-131.1 49.9-181 0-49.9-49.9-49.9-131.1 0-181 49.9-49.9 131.1-49.9 181 0 49.9 49.9 49.9 131.1 0 181z"
      ></path>
    </svg>
  ),
  MOON: (
    <svg width="512" height="512" className="rtl-mirror" viewBox="0 0 512 512">
      <path
        fill="currentColor"
        d="M283.211 512c78.962 0 151.079-35.925 198.857-94.792 7.068-8.708-.639-21.43-11.562-19.35-124.203 23.654-238.262-71.576-238.262-196.954 0-72.222 38.662-138.635 101.498-174.394 9.686-5.512 7.25-20.197-3.756-22.23A258.156 258.156 0 0 0 283.211 0c-141.309 0-256 114.511-256 256 0 141.309 114.511 256 256 256z"
      ></path>
    </svg>
  ),
  MOON_AND_SUN: (
    <svg width="512" height="512" className="rtl-mirror" viewBox="0 0 512 512">
      <path
        fill="currentColor"
        d="M230 506.465C114.09 481.972 27.211 379.084 27.211 256c0-123.222 86.989-225.98 202.79-250.46v500.925Zm50-23.285V381.479c24.017-4.748 46.927-16.406 65.5-34.979 49.9-49.9 49.9-131.1 0-181-18.573-18.573-41.483-30.231-65.5-34.979V28.6l37.9 75.8 100.4-33.5c13.5-4.6 26.4 8.3 21.9 21.9l-33.5 100.4 94.7 47.3c12.8 6.4 12.8 24.6-.2 31.1l-94.7 47.3L440 419.3c4.6 13.5-8.3 26.4-21.9 21.9l-100.4-33.5-37.7 75.48Zm0-134.489V163.31c40.833 11.04 71 48.435 71 92.691s-30.167 81.652-71 92.691Z"
      />
    </svg>
  ),
};

const THEME_TO_ICON = {
  [THEME.LIGHT]: ICONS.SUN,
  [THEME.DARK]: ICONS.MOON,
  [THEME.SYSTEM]: ICONS.MOON_AND_SUN,
};
