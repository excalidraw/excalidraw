import Spinner from "../Spinner";

const ErrorComp = ({ error }: { error: string }) => {
  return (
    <div
      data-testid="ttd-dialog-output-error"
      className="ttd-dialog-output-error"
    >
      Error! <p>{error}</p>
    </div>
  );
};

interface TTDDialogOutputProps {
  errorMessage: string | null;
  canvasRef: React.RefObject<HTMLDivElement>;
  loaded: boolean;
}

export const TTDDialogOutput = ({
  errorMessage,
  canvasRef,
  loaded,
}: TTDDialogOutputProps) => {
  return (
    <div className="ttd-dialog-output-wrapper">
      {errorMessage && <ErrorComp error={errorMessage} />}
      {loaded ? (
        <div
          ref={canvasRef}
          style={{ opacity: errorMessage ? "0.15" : 1 }}
          className="ttd-dialog-output-canvas-container"
        />
      ) : (
        <Spinner size="2rem" />
      )}
    </div>
  );
};
