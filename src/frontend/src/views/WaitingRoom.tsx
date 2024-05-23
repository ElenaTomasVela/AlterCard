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
import { useNavigate, useParams } from "react-router-dom";
import {
  HouseRule,
  HouseRuleDetails,
  IWaitingRoom,
  IWebsocketMessage,
  IWebsocketMessageServer,
  ICardDeck,
  IWaitingRoomMessage,
  WaitingRoomAction,
  IWaitingRoomServerMessage,
  WaitingRoomServerAction,
} from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TooltipArrow } from "@radix-ui/react-tooltip";
import { AuthContext, AuthContextType } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardTitle } from "@/components/ui/card";
import HightlightCard from "@/components/HightlightCard";
import { Label } from "@/components/ui/label";

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

const HouseRuleSwitch = ({
  houseRule,
  disable,
  checked,
  onChange,
}: {
  houseRule: { name: string; description: string; id: string };
  disable: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
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
              checked={checked}
              onCheckedChange={onChange}
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

const DeckSelect = ({
  deck,
  checked,
  onChange,
  disabled,
}: {
  deck: ICardDeck;
  checked: boolean;
  disabled: boolean;
  onChange: (id: string) => void;
}) => {
  return (
    <>
      <input
        name="deck"
        className="hidden peer"
        type="radio"
        id={`deck${deck._id}`}
        value={deck._id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <Label
        htmlFor={`deck${deck._id}`}
        className="group focus:outline-none
        peer-checked:shadow-primary/10 peer-checked:shadow-xl peer-checked:border-primary/40
        "
      >
        <Card className="p-3 flex flex-col text-center border-inherit">
          <CardTitle className="text-lg font-semibold text-gray-500">
            {deck.name}
          </CardTitle>
          <span className="text-gray-700 text-sm">{deck.description}</span>
        </Card>
      </Label>
    </>
  );
};

export const WaitingRoom = () => {
  const { user } = useContext(AuthContext) as AuthContextType;
  const [room, setRoom] = useState<IWaitingRoom>();
  const [decks, setDecks] = useState<ICardDeck[]>([]);
  const [socket, setSocket] = useState<WebSocket>();
  const { roomId } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  const setPlayerReady = (player: string, ready: boolean) => {
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

  const addHouseRule = (rule: HouseRule) => {
    setRoom((r) => {
      if (!r) return;
      const newHouseRules = [...r!.houseRules, rule];
      return {
        ...r,
        houseRules: newHouseRules,
      };
    });
  };

  const removeHouseRule = (rule: HouseRule) => {
    setRoom((r) => {
      if (!r) return;
      const newHouseRules = r.houseRules.filter((r) => r != rule);
      return {
        ...r,
        houseRules: newHouseRules,
      };
    });
  };

  const chooseDeck = (deckId: string) => {
    setRoom((r) => {
      if (!r) return;
      return {
        ...r,
        deck: deckId,
      };
    });
  };

  const connect = async () => {
    const fetchedRoom = await api.get("/room/" + roomId);
    setRoom(fetchedRoom.data);

    const webSocket = new WebSocket(
      `${import.meta.env.VITE_BACKEND_WS_URL}/room/${fetchedRoom.data._id}/ws`,
    );
    await waitForSocketConnection(webSocket);
    toast({ description: "Successfully connected to the room" });

    webSocket.addEventListener("message", (message) => {
      if (message.data === "success") return;
      const msgObject: IWaitingRoomServerMessage = JSON.parse(message.data);
      switch (msgObject.action) {
        case "playerJoined":
          if (typeof msgObject.data !== "string") return;
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
        case WaitingRoomServerAction.start:
          navigate("/game/" + msgObject.data);
          break;
        case WaitingRoomServerAction.ready:
          if (typeof msgObject.data !== "boolean") return;
          setPlayerReady(msgObject.user!, msgObject.data);
          break;
        case "addRule":
          if (typeof msgObject.data !== "string") return;
          addHouseRule(msgObject.data as HouseRule);
          break;
        case "removeRule":
          if (typeof msgObject.data !== "string") return;
          console.log("removing");
          removeHouseRule(msgObject.data as HouseRule);
          break;
        case WaitingRoomServerAction.setDeck:
          if (typeof msgObject.data !== "string") return;
          chooseDeck(msgObject.data);
          break;
        case WaitingRoomServerAction.newHost:
        case WaitingRoomServerAction.error:
        default:
          break;
      }
    });
    setSocket(webSocket);
    return webSocket;
  };

  useEffect(() => {
    const fetchDecks = async () => {
      const response = await api.get<ICardDeck[]>("/deck");
      setDecks(response.data);
    };
    const ws = connect();
    fetchDecks();

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

  const changeHouseRule = async (id: HouseRule, add: boolean) => {
    if (!socket || !user) return;
    if (add) {
      socket?.send(JSON.stringify({ action: "addRule", data: id }));
      addHouseRule(id);
    } else {
      socket?.send(JSON.stringify({ action: "removeRule", data: id }));
      removeHouseRule(id);
    }
  };

  const changeDeck = async (id: string) => {
    if (!socket || !user) return;
    socket.send(
      JSON.stringify({
        action: WaitingRoomAction.setDeck,
        data: id,
      } as IWaitingRoomMessage),
    );
  };

  const startGame = () => {
    if (!socket || !user) return;
    socket.send(JSON.stringify({ action: "start" }));
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
          <div className="flex justify-between flex-wrap w-3/5">
            <div>
              <H2 className="font-normal">Choose your House Rules</H2>
              <div className="flex flex-col gap-3 p-5">
                {room &&
                  HouseRuleDetails.map((r, index) => (
                    <HouseRuleSwitch
                      houseRule={r}
                      key={index}
                      disable={user != room.host?.username}
                      checked={room.houseRules.includes(r.id)}
                      onChange={(add) => changeHouseRule(r.id, add)}
                    />
                  ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <H2 className="font-normal">Choose your Deck</H2>
              <div className="grid grid-cols-3 gap-3">
                {decks &&
                  decks.map((d) => (
                    <DeckSelect
                      deck={d}
                      key={d._id}
                      onChange={changeDeck}
                      checked={room?.deck == d._id}
                      disabled={user != room?.host?.username}
                    />
                  ))}
              </div>
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
          {user == room?.host?.username && (
            <Button onClick={() => startGame()}>Start Game</Button>
          )}
        </span>
      </div>
    </>
  );
};
