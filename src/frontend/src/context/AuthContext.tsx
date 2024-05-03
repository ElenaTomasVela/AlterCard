import { createContext, useEffect, useState } from "react";
import axios from "axios";
import { User } from "@/lib/types";

export interface AuthContextType {
  user: string | undefined;
  login: (userData: User) => Promise<void>;
  logout: () => void;
  signup: (userData: User) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider = ({ children }: { children: JSX.Element }) => {
  const [user, setUser] = useState<string | undefined>();

  useEffect(() => {
    const localUser = localStorage.getItem("user");
    if (localUser) setUser(localUser);
  }, []);

  const signup = async (userData: User) => {
    const response = await axios.post(
      `https://${import.meta.env.VITE_BACKEND_URL}/user/`,
      userData,
      { withCredentials: true },
    );
    if (response.status == 200) {
      // localStorage.setItem("token", response.data);
      localStorage.setItem("user", userData.username);
      setUser(userData.username);
    }
  };

  const login = async (userData: User) => {
    const response = await axios.post(
      `https://${import.meta.env.VITE_BACKEND_URL}/user/login`,
      userData,
      { withCredentials: true },
    );
    if (response.status == 200) {
      // localStorage.setItem("token", response.data);
      localStorage.setItem("user", userData.username);
      setUser(userData.username);
    }
  };

  const logout = () => {
    // localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(undefined);
  };

  return (
    <AuthContext.Provider
      value={{ user: user, login: login, logout: logout, signup: signup }}
    >
      {children}
    </AuthContext.Provider>
  );
};
