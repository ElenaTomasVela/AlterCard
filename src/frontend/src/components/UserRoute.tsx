import { Navigate, Outlet } from "react-router-dom";

export const UserRoute = () => {
  if (!localStorage.getItem("user")) return <Navigate to="/login" />;

  return <Outlet />;
};
