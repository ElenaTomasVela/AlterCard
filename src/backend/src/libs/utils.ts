import mongoose from "mongoose";
import { Card, CardColor, ICard } from "../models/card";
import { IPlayer } from "../models/game/types";

export function shuffle<T>(arr: T[]): T[] {
  // For shuffling, Fisher-Yates' algorithm will be used.
  for (let i = arr.length - 1; i > 0; i--) {
    const chosenIndex = Math.floor(Math.random() * (i + 1));

    const temp = arr[i];
    arr[i] = arr[chosenIndex];
    arr[chosenIndex] = temp;
  }

  return arr;
}

export function dealCards(players: IPlayer[], deck: mongoose.Types.ObjectId[]) {
  for (const player of players) {
    player.hand.push(...deck.splice(0, 7));
  }
}

export async function getFirstNonWild(deck: mongoose.Types.ObjectId[]) {
  const promises = deck.map((c) => Card.findById(c));
  const results = await Promise.all(promises);
  const index = results.findIndex((dbCard) => {
    return dbCard?.color !== CardColor.wild;
  });
  return deck.splice(index, 1)[0];
}
