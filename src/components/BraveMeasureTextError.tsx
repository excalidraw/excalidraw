import Trans from "./Trans";
const BraveMeasureTextError = () => {
  return (
    <div data-testid="brave-measure-text-error">
      <p>
        <Trans
          i18nKey="errors.brave_measure_text_error.line1"
          aggressiveBlockFingerprint={(el: React.ReactNode) => (
            <span style={{ fontWeight: 600 }}>{el}</span>
          )}
        />
      </p>
      <p>
        <Trans
          i18nKey="errors.brave_measure_text_error.line2"
          textElements={(el: React.ReactNode) => (
            <span style={{ fontWeight: 600 }}>{el}</span>
          )}
        />
      </p>
      <p>
        <Trans
          i18nKey="errors.brave_measure_text_error.line3"
          steps={(el: React.ReactNode) => (
            <a href="http://docs.excalidraw.com/docs/@excalidraw/excalidraw/faq#turning-off-aggresive-block-fingerprinting-in-brave-browser">
              {el}
            </a>
          )}
        />
      </p>
      <p>
        <Trans
          i18nKey="errors.brave_measure_text_error.line4"
          issue={(el: React.ReactNode) => (
            <a href="https://github.com/excalidraw/excalidraw/issues/new">
              {el}
            </a>
          )}
          discord={(el: React.ReactNode) => (
            <a href="https://discord.gg/UexuTaE">{el}.</a>
          )}
        />
      </p>
    </div>
  );
};

export default BraveMeasureTextError;
