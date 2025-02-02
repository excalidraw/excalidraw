import React from "react";
import { useCasdoor } from "../casdoor/Hook";

export const CasdoorAuth: React.FC = () => {
  const { user, loading, login, logout } = useCasdoor();

  if (loading) {
    return null;
  }

  return (
    <button 
      className="casdoor-auth-button" 
      onClick={user ? logout : login}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #1664c0',
        backgroundColor: '#1976d2',
        color: 'white',
        cursor: 'pointer'
      }}
    >
      <span>{user ? 'Выйти' : 'Войти через SSO'}</span>
    </button>
  );
};
