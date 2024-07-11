import { Icon } from "@iconify/react/dist/iconify.js";
import { Button } from "./ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Input } from "./ui/input";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { requiredString } from "@/lib/types";
import { stringToColor } from "@/lib/utils";

function Message({
  senderName,
  message,
}: {
  senderName: string;
  message: string;
}) {
  const color = stringToColor(senderName);

  return (
    <span className="">
      <strong className={`mr-1 ${color}`} style={{ color: color }}>
        {senderName}:
      </strong>
      {message}
    </span>
  );
}

export default function Chat<T>({
  socket,
  onSend,
  messageMatcher,
  parserFunction,
  dataExtractFunction,
}: {
  socket: WebSocket;
  onSend: (message: string) => void;
  messageMatcher: (message: T) => boolean;
  parserFunction: (message: string) => T;
  dataExtractFunction: (incomingMessage: T) => {
    message: string;
    senderName: string;
  };
}) {
  const form = useForm<{ message: string }>({
    resolver: zodResolver(z.object({ message: requiredString() })),
  });
  const [messages, setMessages] = useState<
    { message: string; senderName: string }[]
  >([]);
  const chatEl = useRef<HTMLDivElement>(null);
  const [readStatus, setReadStatus] = useState(true);

  function onSubmit(data: { message: string }) {
    onSend(data.message);
    form.reset();
  }

  useEffect(() => {
    if (chatEl.current?.getAttribute("data-state") == "closed") {
      setReadStatus(false);
      return;
    }

    const shouldScroll =
      chatEl.current &&
      chatEl.current.scrollTop + chatEl.current.offsetHeight >=
        chatEl.current.scrollHeight - 50;

    if (shouldScroll) {
      chatEl.current?.scrollTo({
        top: chatEl.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  useEffect(() => {
    const listener = (message: MessageEvent) => {
      const parsedMessage = parserFunction(message.data);

      if (!messageMatcher(parsedMessage)) return;

      setMessages((m) => [...m, dataExtractFunction(parsedMessage)]);
    };
    socket.addEventListener("message", listener);
    return () => {
      socket.removeEventListener("message", listener);
    };
  }, [socket]);

  return (
    <Collapsible
      className="lg:bottom-12 bottom-6 left-0 lg:px-12 px-6 fixed w-full
        lg:w-2/5 flex flex-col-reverse group h-1/2 overflow-hidden z-10"
      onOpenChange={(o) => setReadStatus(o ? true : readStatus)}
    >
      <div className="flex z-10 overflow-hidden flex-shrink-0">
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            type="button"
            className="size-12 rounded-r-full bg-white z-10 shadow-md bottom-0 p-0 -mr-12 aspect-square"
          >
            {readStatus ? (
              <Icon icon="lucide:message-circle" className="size-6" />
            ) : (
              <Icon
                icon="lucide:message-circle-more"
                className="size-6 text-primary-dark"
              />
            )}
          </Button>
        </CollapsibleTrigger>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="h-12 animate-in slide-in-from-left flex
            group-radix-state-closed:w-0 group-radix-state-closed:pl-0 w-full left-0 bottom-0 overflow-hidden
            focus:border-primary transition-all delay-100"
        >
          <Input
            {...form.register("message")}
            placeholder="Type a message"
            className="pl-14 rounded-r-none border-r-0"
            autoComplete="off"
          />
          <Button
            variant="outline"
            type="submit"
            className="h-full aspect-square rounded-l-none bg-white border-l-0 p-0"
          >
            <Icon icon="lucide:send-horizontal" className="size-5" />
          </Button>
        </form>
      </div>
      <CollapsibleContent
        ref={chatEl}
        className="border bg-white rounded-lg flex-1 basis-[50vh]
          animate-in slide-in-from-bottom radix-state-closed:animate-out radix-state-closed:slide-out-to-bottom -z-10
        break-words overflow-scroll"
      >
        <div className="flex flex-col p-4 justify-end">
          {messages.map((m, index) => (
            <Message
              key={index}
              message={m.message}
              senderName={m.senderName}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
