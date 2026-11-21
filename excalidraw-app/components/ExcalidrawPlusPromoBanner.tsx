import {
  PlusPromoIcon,
  brainIcon,
  codeIcon,
  messageCircleIcon,
  microphoneIcon,
  presentationIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import clsx from "clsx";

import type { TranslationKeys } from "@excalidraw/excalidraw/i18n";

const plusLink = (utmContent: string) =>
  `${
    import.meta.env.VITE_APP_PLUS_LP
  }/plus?utm_source=excalidraw&utm_medium=app&utm_content=${utmContent}#excalidraw-redirect`;

// each must stay within the original "Try Excalidraw+ / 14-day free trial"
// button width (~93px of text)
const PROMOS: readonly {
  href: string;
  icon: React.ReactNode;
  title: TranslationKeys;
  subtitle: TranslationKeys;
  className?: string;
}[] = [
  {
    href: plusLink("guestBanner_presentations"),
    icon: presentationIcon,
    title: "promoBanner.presentations",
    subtitle: "promoBanner.withExcalidrawPlus",
  },
  {
    href: plusLink("guestBanner_mcp"),
    icon: brainIcon,
    title: "promoBanner.mcp",
    subtitle: "promoBanner.excalidrawPlusMcp",
  },
  {
    href: plusLink("guestBanner_comments"),
    icon: messageCircleIcon,
    title: "promoBanner.comments",
    subtitle: "promoBanner.withExcalidrawPlus",
  },
  {
    href: plusLink("guestBanner_teams"),
    icon: usersIcon,
    title: "promoBanner.teams",
    subtitle: "promoBanner.withExcalidrawPlus",
  },
  {
    href: plusLink("guestBanner_voice"),
    icon: microphoneIcon,
    title: "promoBanner.voiceChat",
    subtitle: "promoBanner.withExcalidrawPlus",
  },
  {
    href: "https://github.com/excalidraw/cli",
    icon: codeIcon,
    title: "promoBanner.cli",
    subtitle: "promoBanner.cliTagline",
    className: "plus-banner--blue",
  },
];

// picked once per editor load
const promo = PROMOS[Math.floor(Math.random() * PROMOS.length)];

export const ExcalidrawPlusPromoBanner = ({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) => {
  const { t } = useI18n();
  return (
    <a
      href={isSignedIn ? import.meta.env.VITE_APP_PLUS_APP : promo.href}
      target="_blank"
      rel="noopener"
      className={clsx("plus-banner", !isSignedIn && promo.className)}
    >
      <span className="plus-banner__icon">
        {isSignedIn ? PlusPromoIcon : promo.icon}
      </span>
      <span className="plus-banner__text">
        <span className="plus-banner__title">
          {isSignedIn ? t("labels.signIn") : t(promo.title)}
        </span>
        {!isSignedIn && (
          <span className="plus-banner__subtitle">{t(promo.subtitle)}</span>
        )}
      </span>
    </a>
  );
};
