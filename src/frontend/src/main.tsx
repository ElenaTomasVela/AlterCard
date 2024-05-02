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
import { Game } from "./views/Game.tsx";

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
        path: "game",
        element: <UserRoute />,
        children: [
          {
            path: ":gameId",
            element: <Game />,
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

// StrictMode conflicts with WebSockets, so I had to remove it, see https://github.com/facebook/create-react-app/issues/10387
ReactDOM.createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
