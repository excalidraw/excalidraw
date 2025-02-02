const getEnvVar = (name: string): string => {
  const value = import.meta.env[name];
  if (!value) {
    console.error(`Отсутствует переменная окружения: ${name}`);
  }
  return value || '';
};

export const CASDOOR_CONFIG = {
  serverUrl: getEnvVar('VITE_CASDOOR_ENDPOINT'),
  clientId: getEnvVar('VITE_CASDOOR_CLIENT_ID'),
  clientSecret: getEnvVar('VITE_CASDOOR_CLIENT_SECRET'),
  organizationName: getEnvVar('VITE_CASDOOR_ORGANIZATION_NAME'),
  appName: getEnvVar('VITE_CASDOOR_APPLICATION_NAME'),
  redirectUri: getEnvVar('VITE_CASDOOR_REDIRECT_URI'),
};
