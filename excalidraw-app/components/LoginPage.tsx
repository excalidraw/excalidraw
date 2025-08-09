import { jwtDecode } from "jwt-decode";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { saveAuthToken } from "excalidraw-app/data/localStorage";

import { signIn } from "../data/ranggaApi";
import { useUserStore } from "../stores/useUserStore";

import styles from "./LoginPage.module.css";

import type { JwtPayload } from "jwt-decode";

interface DecodedToken extends JwtPayload {
  email?: string;
  user_id?: string;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setLoggedIn = useUserStore((state) => state.setLoggedIn);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    mode: "onTouched",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: LoginFormInputs) => {
    setLoading(true);
    setError(null);
    try {
      const result = await signIn(data.username, data.password);
      saveAuthToken(result.token);

      const decoded = jwtDecode<DecodedToken>(result.token);
      setLoggedIn(decoded?.email ?? null, decoded?.user_id ?? null);

      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Sign in to your account</h2>
        <form
          className={styles.form}
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className={styles.label}>
            <p>Username</p>
            <input
              type="text"
              autoComplete="username"
              required
              className={styles.input}
              {...register("username", {
                required: "Username is required",
                minLength: {
                  value: 3,
                  message: "Username must be at least 3 characters",
                },
              })}
              disabled={loading}
            />
            {errors.username && (
              <p style={{ color: "#e11d48", fontSize: 13, marginTop: 2 }}>
                {errors.username.message}
              </p>
            )}
          </div>
          <div className={styles.label}>
            <p>Password</p>
            <input
              type="password"
              autoComplete="current-password"
              required
              className={styles.input}
              {...register("password", {
                required: "Password is required",
              })}
              disabled={loading}
            />
            {errors.password && (
              <p style={{ color: "#e11d48", fontSize: 13, marginTop: 2 }}>
                {errors.password.message}
              </p>
            )}
          </div>
          {error && (
            <p
              style={{
                color: "#e11d48",
                fontSize: 13,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
  // End of file

  type LoginFormInputs = {
    username: string;
    password: string;
  };
};
//

export default LoginPage;
