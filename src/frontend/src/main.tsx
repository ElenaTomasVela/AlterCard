import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Layout } from "./views/Layout.tsx";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { NotFoundPage } from "./views/NotFoundPage";
import { SignUp } from "./views/SignUp";
import { Login } from "./views/Login";
import { WaitingRoom } from "./views/WaitingRoom";
import { UserRoute } from "./components/UserRoute";
import { RoomListing } from "./views/RoomListing";

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
        path: "rooms",
        element: <UserRoute />,
        children: [
          {
            index: true,
            element: <RoomListing />,
          },
          {
            path: ":roomId",
            element: <WaitingRoom />,
          },
        ],
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
