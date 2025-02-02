export interface CasdoorUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface CasdoorResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}
