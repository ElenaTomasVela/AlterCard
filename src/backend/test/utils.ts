import { GameActionServer, IGameServerMessage } from "../src/models/game/types";

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

export const waitForGameAction = (
  socket: WebSocket,
  action: GameActionServer,
) => {
  return new Promise<IGameServerMessage>((resolve) => {
    const listener = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as IGameServerMessage;
      if (message.action == action) {
        socket.removeEventListener("message", listener);
        resolve(message);
      }
    };
    socket.addEventListener("message", listener);
  });
};

export const getCookieFromResponse = (response: Response) => {
  const cookies = response.headers.getSetCookie();
  const cookiePairs = cookies?.map((cookie) => {
    const value = cookie.split(";")[0];
    return [value.split("=")[0], value.split("=")[1]];
  });
  const cookieObj = Object.fromEntries(cookiePairs);
  return cookieObj;
};
