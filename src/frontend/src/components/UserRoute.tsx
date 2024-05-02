import React, { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext, AuthContextType } from "../context/AuthContext.tsx";

export const UserRoute = () => {
  if (!localStorage.getItem("user")) return <Navigate to="/login" />;

  return <Outlet />;
};
