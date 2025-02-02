import { useCallback, useEffect, useState } from "react";
import SDK from 'casdoor-js-sdk';
import { CASDOOR_CONFIG } from "./Config";
import type { CasdoorUser } from "./Type";

const validateConfig = (config: typeof CASDOOR_CONFIG) => {
  const missingFields = Object.entries(config)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    console.error('Отсутствуют обязательные поля конфигурации:', missingFields);
    return false;
  }
  
  return true;
};

const sdk = validateConfig(CASDOOR_CONFIG) ? new SDK(CASDOOR_CONFIG) : null;

export const useCasdoor = () => {
  const [user, setUser] = useState<CasdoorUser | null>(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback(() => {
    if (!sdk) {
      console.error("Casdoor SDK не инициализирован");
      return;
    }
    const url = sdk.getSigninUrl();
    window.location.href = url;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("casdoor_token");
    setUser(null);
  }, []);

  useEffect(() => {
    const getCurrentUser = async () => {
      const token = localStorage.getItem("casdoor_token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${CASDOOR_CONFIG.serverUrl}/api/userinfo`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error("Ошибка получения данных пользователя:", error);
      } finally {
        setLoading(false);
      }
    };

    getCurrentUser();
  }, []);

  return { user, loading, login, logout };
};
