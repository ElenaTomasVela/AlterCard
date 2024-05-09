import mongoose from "mongoose";
import { IPlayer } from "../models/game";
import { Card, CardColor, ICard } from "../models/card";

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

export function getFirstNonWild(deck: mongoose.Types.ObjectId[]) {
  const index = deck.findIndex(async (card) => {
    const dbCard = await Card.findById(card);
    return dbCard?.color !== CardColor.wild;
  });
  return deck.splice(index, 1)[0];
}
