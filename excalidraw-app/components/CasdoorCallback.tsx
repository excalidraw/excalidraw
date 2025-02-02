import React, { useEffect } from "react";
import SdkDefault from "casdoor-js-sdk";
import { CASDOOR_CONFIG } from "../casdoor/Config";

export const CasdoorCallback: React.FC = () => {
  useEffect(() => {
    const handleCallback = async () => {
      const sdk = new SdkDefault(CASDOOR_CONFIG);
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      
      if (code) {
        try {
          const response = await sdk.signin(code);
          const data = await response.json();
          
          if (data.access_token) {
            localStorage.setItem("casdoor_token", data.access_token);
            window.location.href = "/";
          }
        } catch (error) {
          console.error("Ошибка авторизации:", error);
        }
      }
    };

    handleCallback();
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh' 
    }}>
      Выполняется авторизация...
    </div>
  );
};
