import { H1, H2, H3 } from "@/components/Headings";
import { Switch } from "@/components/ui/switch";
import React, { useContext, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import {
  api,
  waitForSocketConnection,
  waitForSocketMessage,
} from "@/lib/utils";
import { useParams } from "react-router-dom";
import {
  HouseRuleDetails,
  IWaitingRoom,
  IWebsocketMessage,
  IWebsocketMessageServer,
} from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TooltipArrow } from "@radix-ui/react-tooltip";
import { AuthContext, AuthContextType } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const Player = ({
  player,
}: {
  player: { user: { username: string }; ready?: boolean };
}) => {
  return (
    <>
      <span className="flex gap-2 justify-between">
        <span className="flex items-center gap-2">
          <Icon icon="ic:sharp-person" className="size-10" />
          <span className="text-lg">{player.user.username}</span>
        </span>
        <span
          className={`${player.ready ? "bg-primary/30" : "bg-accent/30"} py-1 px-2 rounded-full h-fit my-auto whitespace-nowrap`}
        >
          {player.ready ? "Ready" : "Not ready"}
        </span>
      </span>
    </>
  );
};

const HouseRule = ({
  houseRule,
  disable,
}: {
  houseRule: { name: string; description: string; id: string };
  disable: boolean;
}) => {
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-3">
            <Switch
              className="shadow-inner"
              id={houseRule.id}
              disabled={disable}
            />
            <label
              className="cursor-pointer select-none"
              htmlFor={houseRule.id}
            >
              {houseRule.name}
            </label>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{houseRule.description}</p>
          <TooltipArrow className="fill-gray-200 w-5 h-3" />
        </TooltipContent>
      </Tooltip>
    </>
  );
};

export const WaitingRoom = () => {
  const { user } = useContext(AuthContext) as AuthContextType;
  const [room, setRoom] = useState<IWaitingRoom>();
  const [socket, setSocket] = useState<WebSocket>();
  const { roomId } = useParams();
  const { toast } = useToast();

  const setPlayerReady = (player: string, ready: boolean) => {
    console.log("setting ready", player, ready);
    setRoom((r) => {
      if (!r) return;
      const newPlayers = r.users.map((u) =>
        u.user.username == player ? { ...u, ready: ready } : u,
      );
      return {
        ...r,
        users: newPlayers,
      };
    });
  };

  const addPlayer = (player: string) => {
    setRoom((r) => ({
      ...r!,
      users: [
        ...r!.users,
        {
          user: { username: player },
          ready: false,
        },
      ],
    }));
  };

  const connect = async () => {
    const fetchedRoom = await api.get("/room/" + roomId);
    setRoom(fetchedRoom.data);

    const webSocket = new WebSocket(
      `ws://${import.meta.env.VITE_BACKEND_URL}/room/${fetchedRoom.data._id}/ws`,
    );
    await waitForSocketConnection(webSocket);
    toast({ description: "Successfully connected to the room" });

    webSocket.addEventListener("message", (message) => {
      if (message.data === "success") return;
      const msgObject: IWebsocketMessageServer = JSON.parse(message.data);
      switch (msgObject.action) {
        case "playerJoined":
          addPlayer(msgObject.data);
          break;
        case "playerLeft":
          setRoom((r) => {
            if (!r) return;
            const newPlayers = r?.users.filter(
              (u) => u.user.username != msgObject.data,
            );
            return {
              ...r,
              users: newPlayers,
            };
          });
          break;
        case "startGame":
          break;
        case "ready":
          if (typeof msgObject.data !== "boolean") return;
          setPlayerReady(msgObject.user, msgObject.data);
          break;
        case "houseRuleAdded":
          break;
        case "houseRuleRemoved":
          break;
        default:
          break;
      }
      setSocket(webSocket);
    });
    return webSocket;
  };

  useEffect(() => {
    const ws = connect();

    return () => {
      ws.then((ws) => ws.close());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getReady = async (ready: boolean) => {
    if (!socket || !user) return;
    socket?.send(JSON.stringify({ action: "ready", data: ready }));
    setPlayerReady(user, ready);
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        <H1>Waiting Room</H1>
        <div className="flex gap-8 justify-between flex-wrap">
          <div className="">
            <H2 className="font-normal">Current Players</H2>
            <div className="flex flex-col p-2">
              {room?.users &&
                room.users.map((p, index) => <Player player={p} key={index} />)}
            </div>
          </div>
          <div className="flex justify-between flex-wrap w-1/2">
            <div>
              <H2 className="font-normal">Choose your House Rules</H2>
              <div className="flex flex-col gap-3 p-5">
                {room &&
                  HouseRuleDetails.map((r, index) => (
                    <HouseRule
                      houseRule={r}
                      key={index}
                      disable={user != room.host.username}
                    />
                  ))}
              </div>
            </div>
            <div>
              <H2 className="font-normal">Choose your Deck</H2>
            </div>
          </div>
        </div>
        <span className="flex flex-col items-center gap-3">
          <span className="flex items-center gap-3">
            <Switch id="ready" onCheckedChange={getReady} />
            <label htmlFor="ready" className="cursor-pointer select-none">
              I'm ready
            </label>
          </span>
          <Button>Start Game</Button>
        </span>
      </div>
    </>
  );
};
