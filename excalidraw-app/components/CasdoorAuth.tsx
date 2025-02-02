import React from "react";
import { useCasdoor } from "../casdoor/Hook";
import { loginIcon } from "../../packages/excalidraw/components/icons";

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
        padding: '8px 16px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: user ? '#dc3545' : '#1976d2',
        color: 'white',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        transition: 'background-color 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 100
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>
        {loginIcon}
      </span>
      <span>{user ? 'Выйти' : 'Войти через SSO'}</span>
    </button>
  );
};
