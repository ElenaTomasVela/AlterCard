import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { Layout } from "./views/Layout.tsx";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { NotFoundPage } from "./views/NotFoundPage.tsx";
import { SignUp } from "./views/SignUp.tsx";
import { Login } from "./views/Login.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <App />,
      },
      {
        path: "signup",
        element: <SignUp />,
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
