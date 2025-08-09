import axios from "axios";

import { getAuthToken } from "./localStorage";

const BASE_URL = `${import.meta.env.VITE_APP_RANGGA_BE_URL}/api/v1`;

const axiosClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAuthToken()}`,
  },
});

export const signIn = async (email: string, password: string) => {
  const response = await axiosClient.post(
    `/auth/signin`,
    { email, password },
    { withCredentials: true },
  );

  const token = response.data.token;
  axiosClient.defaults.headers.common.Authorization = `Bearer ${token}`;

  return response.data;
};

export const signOut = async () => {
  const response = await axiosClient.post(
    `/auth/signout`,
    {},
    { withCredentials: true },
  );

  delete axiosClient.defaults.headers.common.Authorization;

  return response.data;
};
