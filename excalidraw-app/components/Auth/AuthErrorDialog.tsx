import { parseEmailValidationError } from "./validateEmail";
import "./AuthErrorDialog.scss";

type Props = {
  error: unknown;
  onClose: () => void;
};

export const AuthErrorDialog = ({ 
  error,
  onClose 
}: Props) => {
  return (
    <div className="auth-error-dialog" role="alert">
      <div className="auth-error-content">
        {parseEmailValidationError(error)}
      </div>
      <button onClick={onClose} aria-label="Close error message">
        ✕
      </button>
    </div>
  );
};