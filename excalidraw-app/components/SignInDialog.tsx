import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { KEYS } from "@excalidraw/common";
import { useState } from "react";

import { signInWithMagicLink } from "../data/supabase/auth";

import "./SignInDialog.scss";

export const SignInDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const submit = async () => {
    if (!email || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: signInError } = await signInWithMagicLink(email);
      if (signInError) {
        setError(signInError.message);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      size="small"
      onCloseRequest={onClose}
      title="Sign in to sync"
      className="SignInDialog"
    >
      <div className="SignInDialog__content">
        <p className="SignInDialog__description">
          We'll email you a magic link.
        </p>
        <TextField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          onKeyDown={(event) => event.key === KEYS.ENTER && submit()}
        />
        <div className="SignInDialog__actions">
          <FilledButton
            label="Send magic link"
            status={submitting ? "loading" : undefined}
            onClick={submit}
          />
        </div>
        {sent && (
          <p className="SignInDialog__confirmation">
            ✓ Check your inbox to finish signing in.
          </p>
        )}
        {error && <p className="SignInDialog__error">{error}</p>}
      </div>
    </Dialog>
  );
};
