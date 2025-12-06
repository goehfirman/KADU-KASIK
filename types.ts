import React from 'react';

export interface MathCard {
  id: string;
  question: string;     // e.g., "4 x 5"
  questionValue: number; // e.g., 20
  answerDisplay: number; // The number shown at the bottom (answer to the NEXT card's question)
  type?: 'normal' | 'wild';
}

export interface Player {
  id: 'p1' | 'p2';
  name: string;
  hand: MathCard[];
  score: number;
  selectedPowerUps: string[]; // The 3 power ups chosen at start
  usedPowerUps: string[]; // List of PowerUp IDs already consumed
}

export interface GameResult {
  p1BaseScore: number;
  p1Penalty: number; // Number of cards left
  p1FinalScore: number;
  p2BaseScore: number;
  p2Penalty: number;
  p2FinalScore: number;
  reason: 'deck_empty' | 'hand_empty';
}

export interface GameState {
  player1: Player;
  player2: Player;
  drawPile: MathCard[];
  arenaCards: MathCard[]; // Changed from arenaCard to arenaCards array for history
  currentTurn: 'p1' | 'p2';
  winner: 'p1' | 'p2' | 'draw' | null;
  gameResult: GameResult | null; // Stores the calculation details
  difficulty: 'easy' | 'medium' | 'hard' | 'custom';
  isBonusTurn: boolean; // If true, the current player can play ANY card (triggered after wild card)
  activeScoreMultiplier: number; // For "Berolahraga" power up
}

export interface GenerationParams {
  count: number;
  difficulty: string;
  topic?: string;
}

export interface PowerUp {
  id: string;
  name: string;
  habitName: string; // The original 7 habit name
  description: string;
  prerequisite: string; // The requirement condition (e.g., "Bangun sebelum jam 5")
  icon: React.ReactNode;
  color: string;
}