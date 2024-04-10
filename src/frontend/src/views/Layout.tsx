import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import { Container } from "../components/Container";
import { AuthProvider } from "@/context/AuthContext";

export const Layout = () => {
  return (
    <>
      <Header />
      <AuthProvider>
        <Container>
          <Outlet />
        </Container>
      </AuthProvider>
    </>
  );
};
