import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import axios from "axios";
import { useState } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
});

export const waitForSocketConnection = (socket: WebSocket) => {
  return new Promise<void>((resolve, reject) => {
    if (socket.readyState !== WebSocket.OPEN) {
      socket.addEventListener("open", () => resolve());
      socket.addEventListener("error", () => reject());
      socket.addEventListener("close", () => reject());
    } else {
      resolve();
    }
  });
};

export const waitForSocketMessage = (socket: WebSocket) => {
  return new Promise<string>((resolve) => {
    socket.addEventListener("message", (event) => resolve(event.data), {
      once: true,
    });
  });
};
