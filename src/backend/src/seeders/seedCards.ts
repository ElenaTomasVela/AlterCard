import mongoose from "mongoose";
import { Card, CardColor, CardDeck, CardSymbol } from "../models/card";

const cards = [
  { symbol: CardSymbol.zero, color: CardColor.red, repeat: 1 },
  { symbol: CardSymbol.one, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.two, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.three, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.four, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.five, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.six, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.seven, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.eight, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.nine, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.draw2, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.reverseTurn, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.skipTurn, color: CardColor.red, repeat: 2 },
  { symbol: CardSymbol.zero, color: CardColor.yellow, repeat: 1 },
  { symbol: CardSymbol.one, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.two, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.three, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.four, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.five, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.six, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.seven, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.eight, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.nine, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.draw2, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.reverseTurn, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.skipTurn, color: CardColor.yellow, repeat: 2 },
  { symbol: CardSymbol.zero, color: CardColor.blue, repeat: 1 },
  { symbol: CardSymbol.one, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.two, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.three, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.four, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.five, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.six, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.seven, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.eight, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.nine, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.draw2, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.reverseTurn, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.skipTurn, color: CardColor.blue, repeat: 2 },
  { symbol: CardSymbol.zero, color: CardColor.green, repeat: 1 },
  { symbol: CardSymbol.one, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.two, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.three, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.four, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.five, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.six, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.seven, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.eight, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.nine, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.draw2, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.reverseTurn, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.skipTurn, color: CardColor.green, repeat: 2 },
  { symbol: CardSymbol.draw4, color: CardColor.wild, repeat: 4 },
  { symbol: CardSymbol.changeColor, color: CardColor.wild, repeat: 4 },
];

export async function seedCards() {
  Card.deleteMany({});
  CardDeck.deleteMany({});
  const cardDeck: mongoose.Types.ObjectId[] = [];
  for (const cardDef of cards) {
    const card = new Card({
      symbol: cardDef.symbol,
      color: cardDef.color,
    });
    await card.save();

    for (let i = 0; i < cardDef.repeat; i++) {
      cardDeck.push(card._id);
    }
  }

  const dbDeck = new CardDeck({
    name: "Basic",
    description: "The standard experience",
    cards: cardDeck,
  });
  await dbDeck.save();
}
