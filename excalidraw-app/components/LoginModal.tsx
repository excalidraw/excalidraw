import React from "react";
import { useForm } from "react-hook-form";

import styles from "./LoginModal.module.css";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string; password: string }>();

  if (!isOpen) {
    return null;
  }

  const onSubmit = (data: { email: string; password: string }) => {
    onLogin(data.email, data.password);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className={styles.title}>Login</h2>
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={styles.input}
            autoFocus
            {...register("email", {
              required: "Email is required",
              pattern: { value: /.+@.+\..+/, message: "Invalid email" },
            })}
          />
          {errors.email && (
            <span
              style={{
                color: "var(--color-danger, #d32f2f)",
                fontSize: "0.95em",
              }}
            >
              {errors.email.message}
            </span>
          )}

          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={styles.input}
            {...register("password", { required: "Password is required" })}
          />
          {errors.password && (
            <span
              style={{
                color: "var(--color-danger, #d32f2f)",
                fontSize: "0.95em",
              }}
            >
              {errors.password.message}
            </span>
          )}

          <button
            type="submit"
            className={styles.loginButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};
