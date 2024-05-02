import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import { Container } from "../components/Container";
import { AuthProvider } from "@/context/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export const Layout = () => {
  return (
    <>
      <AuthProvider>
        <>
          <TooltipProvider>
            <Header />
            <Container>
              <Outlet />
            </Container>
          </TooltipProvider>
        </>
      </AuthProvider>
    </>
  );
};
