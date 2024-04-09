import { Outlet } from "react-router-dom";
import { Header } from "../components/Header";
import { Container } from "../components/Container";

export const Layout = () => {
  return (
    <>
      <Header />
      <Container>
        <Outlet />
      </Container>
    </>
  );
};
