import { createContext, useState } from "react";
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

  const signup = async (userData: User) => {
    const response = await axios.post(
      `${import.meta.env.VITE_BACKEND_URL}/user/`,
      userData,
    );
    if (response.status == 200) {
      localStorage.setItem("token", response.data);
      setUser(userData.username);
    }
    return response;
  };

  const login = async (userData: User) => {
    const response = await axios.post(
      `${import.meta.env.VITE_BACKEND_URL}/user/login`,
      userData,
    );
    if (response.status == 200) {
      localStorage.setItem("token", response.data);
      setUser(userData.username);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
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
