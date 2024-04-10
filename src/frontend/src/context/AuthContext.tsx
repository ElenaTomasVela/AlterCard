import { createContext, useState } from "react";
import axios from "axios";

type User = {
  username: string;
  password: string;
};

type AuthContextType =
  | {
      user: string | undefined;
      login: (userData: User) => void;
      logout: () => void;
    }
  | undefined;

export const AuthContext = createContext<AuthContextType>(undefined);

export const AuthProvider = ({ children }: { children: JSX.Element }) => {
  const [user, setUser] = useState();

  const login = async (userData: User) => {
    const response = await axios.post(
      `${process.env.BACKEND_URL}/user/login`,
      userData,
    );
    if (response.status == 200) {
      localStorage.setItem("token", response.data.token);
      setUser(response.data.user.username);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(undefined);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
