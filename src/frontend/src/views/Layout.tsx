import { Outlet } from "react-router-dom";
import { Header, MobileHeader } from "../components/Header";
import { Container } from "../components/Container";
import { AuthProvider } from "@/context/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

export const Layout = () => {
  return (
    <>
      <AuthProvider>
        <>
          <TooltipProvider>
            <Header />
            <MobileHeader />
            <Container>
              <Outlet />
            </Container>
            <Toaster />
          </TooltipProvider>
        </>
      </AuthProvider>
    </>
  );
};
