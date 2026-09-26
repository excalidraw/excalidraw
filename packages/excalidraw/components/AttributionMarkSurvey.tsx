import { useState } from "react";

import { trackEvent } from "../analytics";
import { t } from "../i18n";

import "./AttributionMarkSurvey.scss";

export type AttributionSurveyQuestionId =
  | "reason"
  | "purpose"
  | "keepOn"
  | "role";

export type AttributionSurveyAnswer = {
  optionId: string;
  /** only set when optionId === "other" */
  otherText?: string;
};

export type AttributionSurveyAnswers = Partial<
  Record<AttributionSurveyQuestionId, AttributionSurveyAnswer>
>;

type AttributionSurveyOption = {
  id: string;
  label: string;
};

type AttributionSurveyQuestion = {
  id: AttributionSurveyQuestionId;
  label: string;
  hint: string;
  allowOther: boolean;
  options: AttributionSurveyOption[];
};

export const ATTRIBUTION_SURVEY_QUESTION_IDS: AttributionSurveyQuestionId[] = [
  "reason",
  "purpose",
  "keepOn",
  "role",
];

// Copy source of truth: excalidraw-attribution-vision.md, Section 6 /
// Section 9.7 (confirmed verbatim against the Figma reference).
//
// Option labels are spelled out as literal `t()` keys (rather than built
// via template-literal interpolation) so they stay checked against the
// generated locale-keys type.
const getAttributionSurveyQuestions = (): AttributionSurveyQuestion[] => [
  {
    id: "reason",
    label: t("imageExportDialog.attributionSurvey.questions.reason.label"),
    hint: t("imageExportDialog.attributionSurvey.hintPickOneFillOther"),
    allowOther: true,
    options: [
      {
        id: "design",
        label: t(
          "imageExportDialog.attributionSurvey.questions.reason.options.design",
        ),
      },
      {
        id: "branding",
        label: t(
          "imageExportDialog.attributionSurvey.questions.reason.options.branding",
        ),
      },
      {
        id: "advertise",
        label: t(
          "imageExportDialog.attributionSurvey.questions.reason.options.advertise",
        ),
      },
      {
        id: "content",
        label: t(
          "imageExportDialog.attributionSurvey.questions.reason.options.content",
        ),
      },
    ],
  },
  {
    id: "purpose",
    label: t("imageExportDialog.attributionSurvey.questions.purpose.label"),
    hint: t("imageExportDialog.attributionSurvey.hintPickOneFillOther"),
    allowOther: true,
    options: [
      {
        id: "github",
        label: t(
          "imageExportDialog.attributionSurvey.questions.purpose.options.github",
        ),
      },
      {
        id: "blog",
        label: t(
          "imageExportDialog.attributionSurvey.questions.purpose.options.blog",
        ),
      },
      {
        id: "slides",
        label: t(
          "imageExportDialog.attributionSurvey.questions.purpose.options.slides",
        ),
      },
      {
        id: "social",
        label: t(
          "imageExportDialog.attributionSurvey.questions.purpose.options.social",
        ),
      },
      {
        id: "client",
        label: t(
          "imageExportDialog.attributionSurvey.questions.purpose.options.client",
        ),
      },
      {
        id: "teaching",
        label: t(
          "imageExportDialog.attributionSurvey.questions.purpose.options.teaching",
        ),
      },
    ],
  },
  {
    id: "keepOn",
    label: t("imageExportDialog.attributionSurvey.questions.keepOn.label"),
    hint: t("imageExportDialog.attributionSurvey.hintPickOne"),
    allowOther: false,
    options: [
      {
        id: "subtler",
        label: t(
          "imageExportDialog.attributionSurvey.questions.keepOn.options.subtler",
        ),
      },
      {
        id: "publicOnly",
        label: t(
          "imageExportDialog.attributionSurvey.questions.keepOn.options.publicOnly",
        ),
      },
      {
        id: "ownBrand",
        label: t(
          "imageExportDialog.attributionSurvey.questions.keepOn.options.ownBrand",
        ),
      },
      {
        id: "never",
        label: t(
          "imageExportDialog.attributionSurvey.questions.keepOn.options.never",
        ),
      },
    ],
  },
  {
    id: "role",
    label: t("imageExportDialog.attributionSurvey.questions.role.label"),
    hint: t("imageExportDialog.attributionSurvey.hintPickOneFillOther"),
    allowOther: true,
    options: [
      {
        id: "developer",
        label: t(
          "imageExportDialog.attributionSurvey.questions.role.options.developer",
        ),
      },
      {
        id: "designer",
        label: t(
          "imageExportDialog.attributionSurvey.questions.role.options.designer",
        ),
      },
      {
        id: "pm",
        label: t(
          "imageExportDialog.attributionSurvey.questions.role.options.pm",
        ),
      },
      {
        id: "student",
        label: t(
          "imageExportDialog.attributionSurvey.questions.role.options.student",
        ),
      },
      {
        id: "teacher",
        label: t(
          "imageExportDialog.attributionSurvey.questions.role.options.teacher",
        ),
      },
    ],
  },
];

const OTHER_OPTION_ID = "other";

/**
 * Reports a completed survey as one anonymous event per question. The free
 * text typed under "Other" is never sent, only that "other" was chosen.
 */
export const trackAttributionSurveyAnswers = (
  answers: AttributionSurveyAnswers,
) => {
  for (const id of ATTRIBUTION_SURVEY_QUESTION_IDS) {
    const answer = answers[id];
    if (answer) {
      trackEvent("export", `attribution-survey-${id}`, answer.optionId);
    }
  }
};

const getAnswerSummaryLabel = (
  question: AttributionSurveyQuestion,
  answer: AttributionSurveyAnswer,
) => {
  if (answer.optionId === OTHER_OPTION_ID) {
    return answer.otherText || t("imageExportDialog.attributionSurvey.other");
  }
  return (
    question.options.find((option) => option.id === answer.optionId)?.label ??
    ""
  );
};

type AttributionMarkSurveyProps = {
  answers: AttributionSurveyAnswers;
  onAnswer: (
    questionId: AttributionSurveyQuestionId,
    answer: AttributionSurveyAnswer,
  ) => void;
};

export const AttributionMarkSurvey = ({
  answers,
  onAnswer,
}: AttributionMarkSurveyProps) => {
  const questions = getAttributionSurveyQuestions();
  const [otherRevealed, setOtherRevealed] = useState(false);
  const [otherDraft, setOtherDraft] = useState("");

  const activeIndex = questions.findIndex((q) => !answers[q.id]);

  const selectOption = (
    questionId: AttributionSurveyQuestionId,
    optionId: string,
  ) => {
    setOtherRevealed(false);
    setOtherDraft("");
    onAnswer(questionId, { optionId });
  };

  const confirmOther = (question: AttributionSurveyQuestion) => {
    const otherText = otherDraft.trim();
    if (!otherText) {
      return;
    }
    onAnswer(question.id, { optionId: OTHER_OPTION_ID, otherText });
    setOtherDraft("");
    setOtherRevealed(false);
  };

  return (
    <div className="AttributionMarkSurvey">
      <div className="AttributionMarkSurvey__header">
        {t("imageExportDialog.attributionSurvey.header")}
      </div>
      {questions.map((question, index) => {
        const answer = answers[question.id];
        const isActive = index === activeIndex;

        if (!answer && !isActive) {
          // question not reached yet — one question visible at a time
          return null;
        }

        return (
          <div className="AttributionMarkSurvey__question" key={question.id}>
            <div className="AttributionMarkSurvey__question__row">
              <span className="AttributionMarkSurvey__question__progress">
                {index + 1}/{questions.length}
              </span>
              <span className="AttributionMarkSurvey__question__label">
                {question.label}
              </span>
              {isActive && !answer && (
                <span className="AttributionMarkSurvey__question__hint">
                  {question.hint}
                </span>
              )}
              {answer && (
                <span className="AttributionMarkSurvey__question__done">
                  ✓ {t("imageExportDialog.attributionSurvey.done")}
                </span>
              )}
            </div>

            {answer && (
              <div className="AttributionMarkSurvey__question__answer">
                {getAnswerSummaryLabel(question, answer)}
              </div>
            )}

            {isActive && !answer && (
              <div className="AttributionMarkSurvey__question__options">
                {question.options.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className="AttributionMarkSurvey__question__option"
                    onClick={() => selectOption(question.id, option.id)}
                  >
                    {option.label}
                  </button>
                ))}
                {question.allowOther && (
                  <div className="AttributionMarkSurvey__question__other">
                    <button
                      type="button"
                      className="AttributionMarkSurvey__question__option"
                      onClick={() => setOtherRevealed(true)}
                    >
                      {t("imageExportDialog.attributionSurvey.other")}
                    </button>
                    {otherRevealed && (
                      <input
                        type="text"
                        className="TextInput"
                        autoFocus
                        placeholder={t(
                          "imageExportDialog.attributionSurvey.otherPlaceholder",
                        )}
                        value={otherDraft}
                        onChange={(event) => setOtherDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            confirmOther(question);
                          }
                        }}
                        onBlur={() => confirmOther(question)}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
