import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import axios, { isAxiosError } from "axios";
import { CardColor, ICard } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (isAxiosError(error)) {
      if (error.response?.status == 401) {
        localStorage.removeItem("user");
      }
    }
    return error;
  },
);

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

export function isMatch(
  card: ICard,
  discardCard: ICard,
  forcedColor?: CardColor,
) {
  return (
    card.color === CardColor.wild ||
    card.symbol === discardCard.symbol ||
    card.color === (forcedColor || discardCard.color)
  );
}

export function isExactMatch(card: ICard, discardCard: ICard) {
  return (
    card.color !== CardColor.wild &&
    card.color === discardCard.color &&
    card.symbol === discardCard.symbol
  );
}

export function stringToColor(str: string, saturation = 100, lightness = 40) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return `hsl(${hash % 360},${saturation}%,${lightness}%)`;
}
