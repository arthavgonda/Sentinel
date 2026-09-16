import { post, setToken, clearToken } from "./client";

export interface LoginStep1Response {
  step: "mfa";
  mfa_token: string;
}

export interface LoginStep2Response {
  token: string;
  user: { id: string; email: string; role: string; name: string };
}

export const authApi = {
  login: (email: string, password: string) =>
    post<LoginStep1Response>("/api/auth/login", { email, password }),

  mfa: async (mfa_token: string, code: string): Promise<LoginStep2Response> => {
    const data = await post<LoginStep2Response>("/api/auth/mfa", { mfa_token, code });
    setToken(data.token);
    return data;
  },

  logout: async () => {
    await post("/api/auth/logout", {});
    clearToken();
  },
};
