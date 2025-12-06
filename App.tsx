import React, { useState, useEffect, useRef } from 'react';
import { Card } from './components/Card';
import { MathCard, Player, GameState, PowerUp, GameResult } from './types';
import { generateMathLoop } from './services/geminiService';
import { 
  Loader2, Trophy, ArrowRight, Zap, 
  Sun, Heart, Dumbbell, Apple, BookOpen, Users, Moon, CheckCircle, Lock, AlertCircle, Swords, X, Info, Play, Book, Award
} from 'lucide-react';

// --- AUDIO ASSETS ---
const SFX = {
  hover: new Audio('https://cdn.pixabay.com/audio/2022/03/24/audio_804e904359.mp3'), // Soft tick
  click: new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_c60b5d5682.mp3'), // Pop/Click
  success: new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3'), // Ding/Chime
  error: new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_88447e7041.mp3'), // Buzz/Error
  powerup: new Audio('https://cdn.pixabay.com/audio/2022/03/24/audio_65191c4d94.mp3'), // Magic shimmer
  win: new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_2d815e966e.mp3'), // Tada/Fanfare
  deal: new Audio('https://cdn.pixabay.com/audio/2022/03/24/audio_c357c9137d.mp3'), // Card slide/flip
};

// Pre-load audio to avoid lag
Object.values(SFX).forEach(audio => {
  audio.load();
  audio.volume = 0.5; // Set reasonable volume
});

const App: React.FC = () => {
  // Setup State
  const [p1Name, setP1Name] = useState("");
  const [p2Name, setP2Name] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Setup Flow State
  const [setupStep, setSetupStep] = useState<'landing' | 'setup' | 'playing' | 'finished'>('landing');
  const [showRules, setShowRules] = useState(false);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  
  const [p1Selection, setP1Selection] = useState<string[]>([]);
  const [p2Selection, setP2Selection] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Modal State for Power Up Details
  const [activeModal, setActiveModal] = useState<{ powerUp: PowerUp, isP1: boolean } | null>(null);
  
  // Tooltip State for In-Game Power Ups
  const [hoveredPowerUp, setHoveredPowerUp] = useState<{ id: string, name: string, desc: string } | null>(null);

  // In-Game UI State
  const [showPowerUpMenu, setShowPowerUpMenu] = useState(false);
  
  // Animation State: dealingIndex tracks how many cards have been "dealt" visually
  // 0-5: P1 Hand, 6-11: P2 Hand, 12: Arena
  const [dealingIndex, setDealingIndex] = useState<number>(100); // 100 = done

  // Refs for auto-scrolling
  const arenaScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTarget, setScrollTarget] = useState<'start' | 'end'>('end');

  // Game State
  const [gameState, setGameState] = useState<GameState>({
    player1: { id: 'p1', name: 'Player 1', hand: [], score: 0, selectedPowerUps: [], usedPowerUps: [] },
    player2: { id: 'p2', name: 'Player 2', hand: [], score: 0, selectedPowerUps: [], usedPowerUps: [] },
    drawPile: [],
    arenaCards: [], 
    currentTurn: 'p1',
    winner: null,
    gameResult: null,
    difficulty: 'medium',
    isBonusTurn: false,
    activeScoreMultiplier: 1
  });

  const [feedback, setFeedback] = useState<{msg: string, type: 'good' | 'bad' | 'bonus' | 'powerup'} | null>(null);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null); // For "Gemar Belajar" hint

  // Constants for 7 Habits Power Ups
  const POWER_UPS: PowerUp[] = [
    { 
      id: 'pagi', 
      habitName: 'Bangun Pagi', 
      name: 'Fajar Menyapa', 
      description: 'Ganti semua kartu di tangan dengan kartu baru.', 
      prerequisite: 'Bangun tidur sebelum pukul 05:00 pagi hari ini.',
      icon: <Sun size={24} />, 
      color: 'bg-orange-500' 
    },
    { 
      id: 'ibadah', 
      habitName: 'Beribadah', 
      name: 'Hati Tenang', 
      description: 'Intip 3 kartu teratas deck, ambil 1.', 
      prerequisite: 'Sudah melaksanakan ibadah/doa hari ini.',
      icon: <Heart size={24} />, 
      color: 'bg-pink-500' 
    },
    { 
      id: 'olahraga', 
      habitName: 'Berolahraga', 
      name: 'Stamina Juara', 
      description: 'Poin x3 untuk jawaban benar berikutnya.', 
      prerequisite: 'Melakukan aktivitas fisik minimal 15 menit hari ini.',
      icon: <Dumbbell size={24} />, 
      color: 'bg-blue-600' 
    },
    { 
      id: 'makan', 
      habitName: 'Makan Sehat', 
      name: 'Nutrisi Otak', 
      description: 'Buang 1 kartu acak dari tangan.', 
      prerequisite: 'Sudah makan sayur atau buah hari ini.',
      icon: <Apple size={24} />, 
      color: 'bg-green-600' 
    },
    { 
      id: 'belajar', 
      habitName: 'Gemar Belajar', 
      name: 'Buku Pintar', 
      description: 'Beritahu kartu jawaban yang benar.', 
      prerequisite: 'Membaca buku atau belajar diluar jam sekolah.',
      icon: <BookOpen size={24} />, 
      color: 'bg-indigo-500' 
    },
    { 
      id: 'masyarakat', 
      habitName: 'Bermasyarakat', 
      name: 'Gotong Royong', 
      description: 'Berikan 1 kartu tanganmu ke lawan.', 
      prerequisite: 'Membantu orang tua atau teman hari ini.',
      icon: <Users size={24} />, 
      color: 'bg-teal-600' 
    },
    { 
      id: 'tidur', 
      habitName: 'Tidur Cepat', 
      name: 'Rehat Sejenak', 
      description: 'Giliran tambahan (Lawan Skip Turn).', 
      prerequisite: 'Tidur sebelum pukul 21:00 tadi malam.',
      icon: <Moon size={24} />, 
      color: 'bg-purple-600' 
    }
  ];

  const difficultyDescriptions = {
    easy: "Perkalian 1 Digit x 1 Digit",
    medium: "Perkalian 1 Digit x 2 Digit",
    hard: "Perkalian 2 Digit x 2 Digit"
  };

  // Helper to play sound safely
  const playSfx = (type: keyof typeof SFX) => {
    try {
      const audio = SFX[type];
      audio.currentTime = 0;
      audio.play().catch(e => {
        // Ignore errors (usually due to lack of user interaction first)
      });
    } catch (e) {
      console.error("Audio play error", e);
    }
  };

  // Auto-scroll logic
  useEffect(() => {
    if (arenaScrollRef.current) {
      if (scrollTarget === 'end') {
        arenaScrollRef.current.scrollTo({
          left: arenaScrollRef.current.scrollWidth,
          behavior: 'smooth'
        });
      } else {
        arenaScrollRef.current.scrollTo({
          left: 0,
          behavior: 'smooth'
        });
      }
    }
  }, [gameState.arenaCards, scrollTarget]);

  // Dealing Animation Loop
  useEffect(() => {
    if (setupStep === 'playing' && dealingIndex < 13) {
      const timer = setTimeout(() => {
        setDealingIndex(prev => prev + 1);
        playSfx('deal');
      }, 200); // Speed of dealing
      return () => clearTimeout(timer);
    }
  }, [dealingIndex, setupStep]);

  // Helper: Shuffle array
  const shuffleDeck = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const openPowerUpModal = (powerUp: PowerUp, isP1: boolean) => {
    playSfx('click');
    setActiveModal({ powerUp, isP1 });
  };

  const closePowerUpModal = () => {
    playSfx('click');
    setActiveModal(null);
  };

  const confirmPowerUpSelection = (powerUpId: string, isP1: boolean) => {
      playSfx('success');
      const selection = isP1 ? p1Selection : p2Selection;
      const setSelection = isP1 ? setP1Selection : setP2Selection;
      
      if (selection.includes(powerUpId)) {
          // Deselect
          setSelection(selection.filter(pid => pid !== powerUpId));
      } else {
          // Select
          if (selection.length >= 3) {
              alert("Maksimal pilih 3 Power Up!");
              return;
          }
          setSelection([...selection, powerUpId]);
      }
      closePowerUpModal();
  };

  const startGame = async (difficulty: string) => {
    playSfx('click');
    if (!p1Name || !p2Name) {
        alert("Mohon isi nama kedua pemain!");
        return;
    }
    setLoading(true);
    try {
      // Logic for Deck Calculation:
      // P1 Hand (6) + P2 Hand (6) + Arena (1) = 13 Cards required immediately.
      // User wants exactly 14 Cards in the Draw Pile.
      // Total Required = 13 + 14 = 27 Cards.
      // We add 2 Wild Cards manually.
      // So we need to generate 25 Math Cards.
      // 25 + 2 = 27 Total.
      
      const baseDeck = await generateMathLoop(25, difficulty, customTopic);
      
      const wildCards: MathCard[] = [
        { id: `wild-1`, question: '?', questionValue: -1, answerDisplay: -1, type: 'wild' },
        { id: `wild-2`, question: '?', questionValue: -1, answerDisplay: -1, type: 'wild' }
      ];

      const fullDeck = shuffleDeck([...baseDeck, ...wildCards]);
      
      let startArenaCard = fullDeck.find(c => c.type !== 'wild')!;
      let remainingDeck = fullDeck.filter(c => c.id !== startArenaCard.id);

      const p1Hand = remainingDeck.slice(0, 6);
      const p2Hand = remainingDeck.slice(6, 12);
      remainingDeck = remainingDeck.slice(12); // Should be exactly 14 cards if generated 25

      setGameState({
        player1: { id: 'p1', name: p1Name, hand: p1Hand, score: 0, selectedPowerUps: p1Selection, usedPowerUps: [] },
        player2: { id: 'p2', name: p2Name, hand: p2Hand, score: 0, selectedPowerUps: p2Selection, usedPowerUps: [] },
        drawPile: remainingDeck,
        arenaCards: [startArenaCard],
        currentTurn: 'p1',
        winner: null,
        gameResult: null,
        difficulty: difficulty as any,
        isBonusTurn: false,
        activeScoreMultiplier: 1
      });
      setDealingIndex(-1); // Start dealing animation
      setSetupStep('playing');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Helper to Calculate Final Scores and end game
  const endGame = (currentGameState: GameState, reason: 'deck_empty' | 'hand_empty') => {
      playSfx('win');
      const p1 = currentGameState.player1;
      const p2 = currentGameState.player2;

      // Penalty: 1 point per card remaining
      const p1Penalty = p1.hand.length;
      const p2Penalty = p2.hand.length;

      const p1Final = p1.score - p1Penalty;
      const p2Final = p2.score - p2Penalty;

      let winner: 'p1' | 'p2' | 'draw' = 'draw';
      if (p1Final > p2Final) winner = 'p1';
      else if (p2Final > p1Final) winner = 'p2';

      const result: GameResult = {
          p1BaseScore: p1.score,
          p1Penalty: p1Penalty,
          p1FinalScore: p1Final,
          p2BaseScore: p2.score,
          p2Penalty: p2Penalty,
          p2FinalScore: p2Final,
          reason: reason
      };

      setGameState(prev => ({
          ...prev,
          winner: winner,
          gameResult: result
      }));
      setSetupStep('finished');
  };

  const activatePowerUp = (powerUpId: string) => {
    playSfx('powerup');
    const currentPlayerKey = gameState.currentTurn === 'p1' ? 'player1' : 'player2';
    const opponentKey = gameState.currentTurn === 'p1' ? 'player2' : 'player1';
    const player = gameState[currentPlayerKey];

    // Mark as used
    const updatedUsedPowerUps = [...player.usedPowerUps, powerUpId];

    // Close menu
    setShowPowerUpMenu(false);

    // Provide Feedback
    const powerUpInfo = POWER_UPS.find(p => p.id === powerUpId);
    setFeedback({ msg: `${powerUpInfo?.name} Diaktifkan!`, type: 'powerup' });
    setTimeout(() => setFeedback(null), 2000);

    setGameState(prev => {
        let newState = { 
            ...prev,
            [currentPlayerKey]: {
                ...prev[currentPlayerKey],
                usedPowerUps: updatedUsedPowerUps
            }
        };

        // Logic Switch
        switch(powerUpId) {
            case 'pagi': // Shuffle Hand
                {
                    const handSize = prev[currentPlayerKey].hand.length;
                    const oldHand = prev[currentPlayerKey].hand;
                    const deck = [...prev.drawPile, ...oldHand];
                    const shuffledDeck = shuffleDeck(deck);
                    const newHand = shuffledDeck.slice(0, handSize);
                    const newPile = shuffledDeck.slice(handSize);
                    
                    newState[currentPlayerKey].hand = newHand;
                    newState.drawPile = newPile;
                }
                break;

            case 'ibadah': // Peek & Pick
                {
                    if (prev.drawPile.length > 0) {
                        const amount = Math.min(3, prev.drawPile.length);
                        const topCards = prev.drawPile.slice(0, amount);
                         const pickedCard = topCards[0]; 
                         newState[currentPlayerKey].hand = [...prev[currentPlayerKey].hand, pickedCard];
                         newState.drawPile = prev.drawPile.slice(1);
                    }
                }
                break;

            case 'olahraga': // Score Multiplier
                newState.activeScoreMultiplier = 3;
                break;

            case 'makan': // Remove 1 random card
                {
                    if (prev[currentPlayerKey].hand.length > 0) {
                        const hand = [...prev[currentPlayerKey].hand];
                        const randomIdx = Math.floor(Math.random() * hand.length);
                        hand.splice(randomIdx, 1);
                        newState[currentPlayerKey].hand = hand;
                        
                        // Check win condition immediately if hand becomes empty
                        if (hand.length === 0) {
                             setTimeout(() => endGame(newState, 'hand_empty'), 500);
                        }
                    }
                }
                break;

            case 'belajar': // Highlight Hint
                {
                    const lastCard = prev.arenaCards[prev.arenaCards.length - 1];
                    const firstCard = prev.arenaCards[0];
                    const hand = prev[currentPlayerKey].hand;
                    
                    const match = hand.find(c => {
                        if (c.type === 'wild') return true;
                        const matchEnd = lastCard.type !== 'wild' && c.questionValue === lastCard.answerDisplay;
                        const matchStart = firstCard.type !== 'wild' && c.answerDisplay === firstCard.questionValue;
                        return matchEnd || matchStart;
                    });
                    
                    if (match) {
                        setHighlightedCardId(match.id);
                        setTimeout(() => setHighlightedCardId(null), 3000);
                    } else {
                        playSfx('error');
                        setFeedback({ msg: "Tidak ada kartu yang cocok!", type: 'bad' });
                        setTimeout(() => setFeedback(null), 2000);
                    }
                }
                break;

            case 'masyarakat': // Give card to opponent
                {
                     if (prev[currentPlayerKey].hand.length > 0) {
                        const myHand = [...prev[currentPlayerKey].hand];
                        const cardToGive = myHand.pop();
                        if (cardToGive) {
                            newState[currentPlayerKey].hand = myHand;
                            newState[opponentKey].hand = [...prev[opponentKey].hand, cardToGive];
                            
                            // Check win if hand empty
                            if (myHand.length === 0) {
                                setTimeout(() => endGame(newState, 'hand_empty'), 500);
                            }
                        }
                     }
                }
                break;

            case 'tidur': // Skip Opponent Turn (Bonus Turn)
                {
                    newState.isBonusTurn = true; 
                }
                break;
        }

        return newState;
    });
  };

  // Turn Logic
  const handleCardPlay = (card: MathCard, player: Player) => {
    if (gameState.currentTurn !== player.id) {
       playSfx('error');
       setFeedback({ msg: "Bukan giliranmu!", type: 'bad' });
       setTimeout(() => setFeedback(null), 1500);
       return;
    }

    if (gameState.arenaCards.length === 0) return;

    const firstArenaCard = gameState.arenaCards[0];
    const lastArenaCard = gameState.arenaCards[gameState.arenaCards.length - 1];

    // --- LOGIC: WILD CARD ---
    if (card.type === 'wild') {
      playSfx('powerup');
      setFeedback({ msg: "KARTU PETIR! Lempar kartu bebas!", type: 'bonus' });
      const newHand = player.hand.filter(c => c.id !== card.id);
      
      // Wild Cards always append to the end for simplicity
      setScrollTarget('end');

      setGameState(prev => {
        const newState = {
            ...prev,
            [prev.currentTurn === 'p1' ? 'player1' : 'player2']: {
            ...prev[prev.currentTurn === 'p1' ? 'player1' : 'player2'],
            hand: newHand,
            score: prev[prev.currentTurn === 'p1' ? 'player1' : 'player2'].score + 20
            },
            arenaCards: [...prev.arenaCards, card],
            isBonusTurn: true, // Enable bonus turn
            activeScoreMultiplier: 1 // Reset multiplier
        };
        
        if (newHand.length === 0) {
            setTimeout(() => endGame(newState, 'hand_empty'), 500);
        }

        return newState;
      });
      return;
    }

    // --- LOGIC: NORMAL MATCH (START or END) OR BONUS TURN ---
    // Note: In visual "Domino" horizontal layout:
    // [Q|A] - [Q|A]
    // A matches Q.
    const matchesEnd = card.questionValue === lastArenaCard.answerDisplay; // [Arena End A] matches [Card Q]
    const matchesStart = card.answerDisplay === firstArenaCard.questionValue; // [Card A] matches [Arena Start Q]
    
    const isMatch = gameState.isBonusTurn || matchesEnd || matchesStart;

    if (isMatch) {
      const baseScore = 10;
      const finalScore = baseScore * gameState.activeScoreMultiplier;
      
      playSfx('success');
      
      let msg = `Benar! +${finalScore}`;
      if (gameState.isBonusTurn) msg += " (Bonus)";
      else if (matchesStart && matchesEnd) msg += " (Double Link!)";
      else if (matchesStart) msg += " (Pasang di Kiri)";
      else msg += " (Pasang di Kanan)";

      setFeedback({ msg, type: gameState.activeScoreMultiplier > 1 ? 'bonus' : 'good' });
      setTimeout(() => setFeedback(null), 1500);

      const newHand = player.hand.filter(c => c.id !== card.id);
      
      setGameState(prev => {
        const updatedPlayer = prev.currentTurn === 'p1' ? 'player1' : 'player2';
        let nextTurn: 'p1' | 'p2' = prev.currentTurn === 'p1' ? 'p2' : 'p1';
        
        let newArenaCards = [...prev.arenaCards];
        
        // Placement Logic
        if (prev.isBonusTurn) {
            newArenaCards.push(card); // Bonus turn extends the chain forward
            setScrollTarget('end');
        } else if (matchesEnd) {
            newArenaCards.push(card);
            setScrollTarget('end');
        } else if (matchesStart) {
            newArenaCards.unshift(card);
            setScrollTarget('start');
        }

        const newState = {
          ...prev,
          [updatedPlayer]: {
            ...prev[updatedPlayer],
            hand: newHand,
            score: prev[updatedPlayer].score + finalScore
          },
          arenaCards: newArenaCards, 
          currentTurn: nextTurn,
          isBonusTurn: false, 
          activeScoreMultiplier: 1 
        };

        if (newHand.length === 0) {
            // Slight delay so player sees the card placed before "Winner" screen
            setTimeout(() => endGame(newState, 'hand_empty'), 500);
        }

        return newState;
      });
      
      setHighlightedCardId(null);

    } else {
      playSfx('error');
      setFeedback({ msg: "Salah! -2 Poin", type: 'bad' });
      setTimeout(() => setFeedback(null), 1500);
      
      setGameState(prev => {
          const currentPlayerKey = prev.currentTurn === 'p1' ? 'player1' : 'player2';
          return {
              ...prev,
              [currentPlayerKey]: {
                  ...prev[currentPlayerKey],
                  score: Math.max(0, prev[currentPlayerKey].score - 2)
              }
          };
      });
    }
  };

  const drawCard = () => {
    if (gameState.isBonusTurn) {
         playSfx('error');
         setFeedback({ msg: "Harus melempar kartu (Efek Petir/Rehat)!", type: 'bad' });
         setTimeout(() => setFeedback(null), 1500);
         return;
    }

    if (gameState.drawPile.length === 0) {
      // GAME OVER CONDITION: DECK EMPTY
      playSfx('error');
      setFeedback({ msg: "Deck Habis! Permainan Selesai.", type: 'bad' });
      setTimeout(() => endGame(gameState, 'deck_empty'), 500);
      return;
    }
    
    playSfx('click');
    const newCard = gameState.drawPile[0];
    const newPile = gameState.drawPile.slice(1);

    setGameState(prev => {
        const updatedPlayerKey = prev.currentTurn === 'p1' ? 'player1' : 'player2';
        return {
            ...prev,
            drawPile: newPile,
            [updatedPlayerKey]: {
                ...prev[updatedPlayerKey],
                hand: [...prev[updatedPlayerKey].hand, newCard]
            },
            currentTurn: prev.currentTurn === 'p1' ? 'p2' : 'p1',
            activeScoreMultiplier: 1
        };
    });
    setFeedback({ msg: "Kartu Diambil. Ganti Giliran.", type: 'bad' });
    setTimeout(() => setFeedback(null), 1500);
  };

  const handleDragStart = (e: React.DragEvent, card: MathCard, playerId: string) => {
    e.dataTransfer.setData('cardId', card.id);
    e.dataTransfer.setData('playerId', playerId);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    const ownerId = e.dataTransfer.getData('playerId');

    const playerKey = ownerId === 'p1' ? 'player1' : 'player2';
    const player = gameState[playerKey];
    const card = player.hand.find(c => c.id === cardId);
    
    if (card) {
      handleCardPlay(card, player);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // ---- RENDER HELPERS ----

  const renderCreditModal = () => {
    if (!showCredit) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
             <div className="bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl relative transform animate-in zoom-in-95 duration-300 border-4 border-yellow-400 text-center">
                 <button 
                    onMouseEnter={() => playSfx('hover')}
                    onClick={() => { playSfx('click'); setShowCredit(false); }}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X size={24} />
                </button>
                <h2 className="text-2xl font-black text-gray-800 uppercase mb-4">Credit</h2>
                <p className="text-lg font-medium text-gray-700 leading-relaxed">
                    Permainan ini terinspirasi dari permainan <span className="text-red-600 font-bold">Kadu Kasik</span> (Kartu Duel Perkalian Asyik) yang dibuat oleh <span className="font-bold text-blue-600">Iqbal Nurzeha</span>, guru SDN Pekayon 09 Jakarta.
                </p>
             </div>
        </div>
    )
  };

  const renderRulesModal = () => {
      if (!showRules) return null;
      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden relative border-8 border-yellow-400 transform animate-in zoom-in-95 duration-300">
                  <div className="bg-yellow-400 p-4 flex justify-between items-center border-b-4 border-yellow-500">
                      <h2 className="text-2xl font-black text-gray-900 uppercase flex items-center gap-2">
                          <Book size={28} /> Aturan Main
                      </h2>
                      <button 
                        onMouseEnter={() => playSfx('hover')}
                        onClick={() => { playSfx('click'); setShowRules(false); }} 
                        className="bg-white/20 p-2 rounded-full hover:bg-white/40 transition"
                      >
                          <X size={24} className="text-black" />
                      </button>
                  </div>
                  
                  <div className="p-8 max-h-[70vh] overflow-y-auto space-y-6 text-gray-800">
                      <div className="flex gap-4 items-start">
                          <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center font-black text-lg flex-shrink-0">1</div>
                          <div>
                              <h3 className="font-black text-lg mb-1">Duel 2 Pemain</h3>
                              <p className="font-medium text-gray-600">Game dimainkan oleh 2 orang. Masing-masing mendapat 6 kartu. Tujuannya adalah menghabiskan kartu di tangan secepat mungkin.</p>
                          </div>
                      </div>

                      <div className="flex gap-4 items-start">
                          <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-black text-lg flex-shrink-0">2</div>
                          <div>
                              <h3 className="font-black text-lg mb-1">Sambungkan Kartu (Domino)</h3>
                              <p className="font-medium text-gray-600">
                                  Cocokkan <strong>Soal Perkalian</strong> pada kartumu dengan <strong>Jawaban (Angka Putih)</strong> di kartu Arena. 
                                  Kartu bisa dipasang di kiri (Awal) atau kanan (Akhir) rangkaian kartu.
                              </p>
                          </div>
                      </div>

                      <div className="flex gap-4 items-start">
                          <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-black text-lg flex-shrink-0">3</div>
                          <div>
                              <h3 className="font-black text-lg mb-1">Power Up 7 Kebiasaan</h3>
                              <p className="font-medium text-gray-600">
                                  Pilih 3 Power Up di awal permainan. Gunakan secara bijak untuk membalikkan keadaan! 
                                  (Contoh: Intip kartu, Skip giliran lawan, dll).
                              </p>
                          </div>
                      </div>

                       <div className="flex gap-4 items-start">
                          <div className="w-10 h-10 bg-yellow-500 text-white rounded-full flex items-center justify-center font-black text-lg flex-shrink-0">4</div>
                          <div>
                              <h3 className="font-black text-lg mb-1">Kartu Petir & Hukuman</h3>
                              <p className="font-medium text-gray-600">
                                  <strong>Kartu Petir (Wild)</strong> bisa menyambung ke mana saja. 
                                  Jika salah pasang kartu, poin dikurangi <strong>2</strong>.
                              </p>
                          </div>
                      </div>
                      
                      <div className="flex gap-4 items-start">
                          <div className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center font-black text-lg flex-shrink-0">5</div>
                          <div>
                              <h3 className="font-black text-lg mb-1">Pemenang</h3>
                              <p className="font-medium text-gray-600">
                                  Game selesai jika kartu di tangan habis atau Deck habis. 
                                  Setiap kartu sisa di tangan mengurangi <strong>1 Poin</strong>. Skor tertinggi menang!
                              </p>
                          </div>
                      </div>
                  </div>

                  <div className="p-4 bg-gray-50 text-center border-t-2 border-gray-100">
                      <button 
                        onMouseEnter={() => playSfx('hover')}
                        onClick={() => { playSfx('click'); setShowRules(false); }}
                        className="px-8 py-3 bg-yellow-400 text-black font-black uppercase rounded-xl hover:bg-yellow-300 shadow-md border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1 transition-all"
                      >
                          Siap Bermain!
                      </button>
                  </div>
              </div>
          </div>
      )
  };

  const renderDeveloperModal = () => {
    if (!showDeveloper) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
             <div className="relative transform animate-in zoom-in-95 duration-300">
                 <button 
                    onMouseEnter={() => playSfx('hover')}
                    onClick={() => { playSfx('click'); setShowDeveloper(false); }}
                    className="absolute -top-4 -right-4 bg-white text-black p-2 rounded-full shadow-lg hover:bg-gray-100 z-50 border-4 border-yellow-400"
                >
                    <X size={24} />
                </button>
                <div className="animate-float">
                    <img 
                        src="https://i.ibb.co.com/35gwkmwh/pengembang.png" 
                        alt="Tentang Pengembang" 
                        className="max-w-[90vw] max-h-[80vh] object-contain drop-shadow-2xl rounded-3xl"
                    />
                </div>
             </div>
        </div>
    )
  };

  const renderLandingPage = () => {
    return (
        <div className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center font-fredoka">
            {/* Background Image */}
            <img 
                src="https://i.ibb.co.com/Myymjm4y/bg.jpg" 
                alt="Background" 
                className="absolute inset-0 w-full h-full object-cover z-0"
            />
            
            {/* Overlay Gradient for readability (optional, kept subtle) */}
            <div className="absolute inset-0 bg-black/10 z-0"></div>

            {/* Credit Button */}
            <button 
                onMouseEnter={() => playSfx('hover')}
                onClick={() => { playSfx('click'); setShowCredit(true); }}
                className="absolute top-4 left-4 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full backdrop-blur-md transition-all z-20 shadow-lg border-2 border-white/30"
                title="Credits"
            >
                <Award size={24} />
            </button>

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center gap-8 p-4 w-full max-w-4xl">
                
                {/* Logo / Title Image */}
                <div className="animate-in slide-in-from-top duration-700 drop-shadow-2xl hover:scale-105 transition-transform cursor-default">
                    <img 
                        src="https://i.ibb.co.com/dscSZ2NX/Player-1.png" 
                        alt="Kadu Kasik Logo" 
                        className="w-full max-w-2xl md:max-w-4xl object-contain"
                    />
                </div>

                {/* Buttons Container */}
                <div className="flex flex-col md:flex-row gap-6 mt-8 w-full justify-center flex-wrap">
                    
                    {/* Button: Ayo Bermain */}
                    <button 
                        onMouseEnter={() => playSfx('hover')}
                        onClick={() => { playSfx('click'); setSetupStep('setup'); }}
                        className="group relative px-8 py-4 bg-gradient-to-b from-green-400 to-green-500 rounded-2xl font-black text-2xl text-white uppercase tracking-wider shadow-[0_6px_0_rgb(21,128,61)] hover:shadow-[0_8px_0_rgb(21,128,61)] hover:-translate-y-1 active:shadow-none active:translate-y-[6px] transition-all duration-150 border-2 border-green-400 min-w-[200px]"
                    >
                        <span className="drop-shadow-md flex items-center justify-center gap-2">
                             <Play fill="white" size={28} /> Ayo Bermain
                        </span>
                        {/* Shine Effect */}
                        <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </button>

                    {/* Button: Aturan Main */}
                    <button 
                        onMouseEnter={() => playSfx('hover')}
                        onClick={() => { playSfx('click'); setShowRules(true); }}
                        className="group relative px-8 py-4 bg-gradient-to-b from-blue-400 to-blue-500 rounded-2xl font-black text-2xl text-white uppercase tracking-wider shadow-[0_6px_0_rgb(29,78,216)] hover:shadow-[0_8px_0_rgb(29,78,216)] hover:-translate-y-1 active:shadow-none active:translate-y-[6px] transition-all duration-150 border-2 border-blue-400 min-w-[200px]"
                    >
                         <span className="drop-shadow-md flex items-center justify-center gap-2">
                             <Book fill="white" size={28} /> Aturan Main
                        </span>
                        {/* Shine Effect */}
                         <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </button>

                     {/* Button: Tentang Pengembang */}
                     <button 
                        onMouseEnter={() => playSfx('hover')}
                        onClick={() => { playSfx('click'); setShowDeveloper(true); }}
                        className="group relative px-8 py-4 bg-gradient-to-b from-purple-400 to-purple-500 rounded-2xl font-black text-2xl text-white uppercase tracking-wider shadow-[0_6px_0_rgb(147,51,234)] hover:shadow-[0_8px_0_rgb(147,51,234)] hover:-translate-y-1 active:shadow-none active:translate-y-[6px] transition-all duration-150 border-2 border-purple-400 min-w-[200px]"
                    >
                         <span className="drop-shadow-md flex items-center justify-center gap-2">
                             <Info size={28} /> Pengembang
                        </span>
                        {/* Shine Effect */}
                         <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </button>

                </div>
            </div>

            {renderCreditModal()}
            {renderRulesModal()}
            {renderDeveloperModal()}
        </div>
    );
  };

  const renderUnifiedSetup = () => {
    return (
      <div className="min-h-screen bg-orange-50 font-fredoka flex flex-col items-center justify-center p-4">
        {/* Title */}
        <div className="text-center mb-6 animate-in slide-in-from-top duration-500">
            <h1 className="text-4xl md:text-5xl font-black text-gray-800 uppercase tracking-wide drop-shadow-md">
                <span className="text-red-600">Kadu</span> <span className="text-blue-600">Kasik</span>
            </h1>
            <p className="text-lg md:text-xl font-bold text-gray-600 mt-2">Kartu Duel Perkalian Asyik</p>
        </div>

        {/* VS Container */}
        <div className="w-full max-w-6xl flex flex-col md:flex-row gap-4 md:gap-8 items-stretch justify-center mb-8">
            
            {/* Player 1 Panel */}
            <div className="flex-1 bg-red-50 rounded-3xl border-[6px] border-red-400 p-6 shadow-xl relative animate-in slide-in-from-left duration-500">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white px-6 py-2 rounded-full font-black uppercase tracking-widest shadow-md border-4 border-white">
                    Player 1
                </div>
                
                <div className="mt-6 mb-6">
                    <label className="block text-sm font-bold text-red-800 mb-1 uppercase">Nama Pemain</label>
                    <input 
                        value={p1Name} 
                        onChange={e => setP1Name(e.target.value)} 
                        className="w-full p-4 rounded-xl border-4 border-red-200 focus:border-red-500 outline-none font-bold text-xl text-center text-gray-900 bg-white placeholder-red-300" 
                        placeholder="Nama Kamu..."
                    />
                </div>

                <div className="text-center">
                    <h3 className="text-lg font-black text-red-700 uppercase mb-2">Pilih 3 Power Up</h3>
                    <p className="text-xs text-red-600 font-bold mb-4 opacity-80">Klik ikon untuk melihat efek & syarat</p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {POWER_UPS.map(power => {
                            const isSelected = p1Selection.includes(power.id);
                            return (
                                <button 
                                    key={power.id}
                                    onMouseEnter={() => playSfx('hover')}
                                    onClick={() => openPowerUpModal(power, true)}
                                    className={`relative p-2 rounded-xl border-2 flex flex-col items-center text-center transition-all duration-200
                                        ${isSelected 
                                            ? `bg-white border-red-600 ring-4 ring-red-300/50 shadow-lg transform -translate-y-1` 
                                            : 'bg-white border-red-100 hover:border-red-300 hover:shadow-md'
                                        }
                                    `}
                                >
                                    <div className={`p-2 rounded-full mb-1 transition-colors ${isSelected ? power.color + ' text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {React.cloneElement(power.icon as React.ReactElement<any>, { size: 20 })}
                                    </div>
                                    <div className={`font-bold text-xs leading-tight ${isSelected ? 'text-red-700' : 'text-gray-500'}`}>
                                        {power.habitName}
                                    </div>
                                    {isSelected && <CheckCircle className="absolute -top-2 -right-2 w-6 h-6 text-green-500 bg-white rounded-full fill-white shadow-sm" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* VS Badge */}
            <div className="hidden md:flex items-center justify-center z-10">
                <div className="w-16 h-16 bg-yellow-400 rounded-full border-4 border-black flex items-center justify-center shadow-xl rotate-12">
                    <Swords className="w-8 h-8 text-black" />
                </div>
            </div>

            {/* Player 2 Panel */}
            <div className="flex-1 bg-blue-50 rounded-3xl border-[6px] border-blue-400 p-6 shadow-xl relative animate-in slide-in-from-right duration-500">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-2 rounded-full font-black uppercase tracking-widest shadow-md border-4 border-white">
                    Player 2
                </div>

                <div className="mt-6 mb-6">
                    <label className="block text-sm font-bold text-blue-800 mb-1 uppercase">Nama Pemain</label>
                    <input 
                        value={p2Name} 
                        onChange={e => setP2Name(e.target.value)} 
                        className="w-full p-4 rounded-xl border-4 border-blue-200 focus:border-blue-500 outline-none font-bold text-xl text-center text-gray-900 bg-white placeholder-blue-300" 
                        placeholder="Nama Lawan..."
                    />
                </div>

                 <div className="text-center">
                    <h3 className="text-lg font-black text-blue-700 uppercase mb-2">Pilih 3 Power Up</h3>
                    <p className="text-xs text-blue-600 font-bold mb-4 opacity-80">Klik ikon untuk melihat efek & syarat</p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {POWER_UPS.map(power => {
                            const isSelected = p2Selection.includes(power.id);
                            return (
                                <button 
                                    key={power.id}
                                    onMouseEnter={() => playSfx('hover')}
                                    onClick={() => openPowerUpModal(power, false)}
                                    className={`relative p-2 rounded-xl border-2 flex flex-col items-center text-center transition-all duration-200
                                        ${isSelected 
                                            ? `bg-white border-blue-600 ring-4 ring-blue-300/50 shadow-lg transform -translate-y-1` 
                                            : 'bg-white border-blue-100 hover:border-blue-300 hover:shadow-md'
                                        }
                                    `}
                                >
                                    <div className={`p-2 rounded-full mb-1 transition-colors ${isSelected ? power.color + ' text-white' : 'bg-gray-100 text-gray-500'}`}>
                                        {React.cloneElement(power.icon as React.ReactElement<any>, { size: 20 })}
                                    </div>
                                    <div className={`font-bold text-xs leading-tight ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>
                                        {power.habitName}
                                    </div>
                                    {isSelected && <CheckCircle className="absolute -top-2 -right-2 w-6 h-6 text-green-500 bg-white rounded-full fill-white shadow-sm" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>

        {/* Start Game Controls */}
        <div className="w-full max-w-lg bg-white p-6 rounded-2xl shadow-xl border-4 border-yellow-400 animate-in fade-in zoom-in duration-700">
             <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2 text-center uppercase">Topik Khusus (Opsional)</label>
                <input 
                    value={customTopic} 
                    onChange={e => setCustomTopic(e.target.value)} 
                    className="w-full p-3 rounded-xl border-2 border-gray-200 outline-none text-center bg-white font-bold" 
                    placeholder="Contoh: Perkalian 7"
                />
            </div>
            
            <div className="mb-4">
                 <label className="block text-sm font-bold text-gray-700 mb-2 text-center uppercase">Pilih Tingkat Kesulitan</label>
                 <div className="grid grid-cols-3 gap-3">
                    {['Easy', 'Medium', 'Hard'].map((d) => {
                        const isSelected = selectedDifficulty === d.toLowerCase();
                        return (
                            <button 
                                key={d} 
                                onMouseEnter={() => playSfx('hover')}
                                onClick={() => { playSfx('click'); setSelectedDifficulty(d.toLowerCase() as any); }}
                                className={`py-3 font-black uppercase rounded-xl transition-all shadow-md border-b-4 text-sm md:text-base
                                    ${isSelected 
                                        ? 'bg-blue-500 text-white border-blue-700 transform translate-y-1 border-b-0 shadow-inner' 
                                        : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                    }
                                `}
                            >
                                {d}
                            </button>
                        );
                    })}
                </div>
                <div className="text-center mt-2 text-sm font-bold text-gray-500 min-h-[20px]">
                    {difficultyDescriptions[selectedDifficulty]}
                </div>
            </div>
            
            <button
                onMouseEnter={() => playSfx('hover')}
                onClick={() => startGame(selectedDifficulty)}
                disabled={loading || !p1Name || !p2Name}
                className="w-full py-4 bg-yellow-400 text-black font-black uppercase rounded-xl hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1 text-xl tracking-wider flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin" /> : <>AYO MAIN <ArrowRight size={24} strokeWidth={3} /></>}
            </button>

             {(!p1Name || !p2Name) && (
                <p className="text-center text-red-500 text-xs font-bold mt-2">Isi nama kedua pemain untuk memulai!</p>
             )}
        </div>

        {/* Modal Overlay */}
        {activeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl transform animate-in zoom-in-95 duration-200 border-4 border-yellow-400 relative">
                    <button 
                        onMouseEnter={() => playSfx('hover')}
                        onClick={closePowerUpModal}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>

                    <div className="text-center mb-6">
                        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${activeModal.powerUp.color} text-white shadow-lg`}>
                            {React.cloneElement(activeModal.powerUp.icon as React.ReactElement<any>, { size: 40 })}
                        </div>
                        <h2 className="text-2xl font-black text-gray-800 uppercase leading-none mb-1">{activeModal.powerUp.habitName}</h2>
                        <h3 className="text-lg font-bold text-yellow-600 mb-2">"{activeModal.powerUp.name}"</h3>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 mb-4 border-2 border-gray-100 text-left">
                         <div className="mb-3">
                             <h4 className="font-black text-gray-700 uppercase text-xs tracking-wider mb-1 flex items-center gap-1">
                                <Zap size={14} className="text-yellow-500" /> Efek Permainan
                             </h4>
                             <p className="text-gray-800 font-medium leading-snug">{activeModal.powerUp.description}</p>
                         </div>
                         <div>
                             <h4 className="font-black text-gray-700 uppercase text-xs tracking-wider mb-1 flex items-center gap-1">
                                <CheckCircle size={14} className="text-green-500" /> Syarat (Prerequisite)
                             </h4>
                             <p className="text-gray-800 font-medium leading-snug italic">"{activeModal.powerUp.prerequisite}"</p>
                         </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onMouseEnter={() => playSfx('hover')}
                            onClick={closePowerUpModal}
                            className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Batal
                        </button>
                        
                        {(activeModal.isP1 ? p1Selection : p2Selection).includes(activeModal.powerUp.id) ? (
                             <button 
                                onMouseEnter={() => playSfx('hover')}
                                onClick={() => confirmPowerUpSelection(activeModal.powerUp.id, activeModal.isP1)}
                                className="flex-1 py-3 font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-md border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all"
                            >
                                Hapus Pilihan
                            </button>
                        ) : (
                            <button 
                                onMouseEnter={() => playSfx('hover')}
                                onClick={() => confirmPowerUpSelection(activeModal.powerUp.id, activeModal.isP1)}
                                className="flex-1 py-3 font-bold text-white bg-green-500 hover:bg-green-600 rounded-xl shadow-md border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all"
                            >
                                Saya Sudah Lakukan
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}

      </div>
    );
  };


  const renderPlayerArea = (player: Player, isLeft: boolean) => {
    const isMyTurn = gameState.currentTurn === player.id;
    const isBonusPhase = isMyTurn && gameState.isBonusTurn;
    
    // Filter powerups to show only selected ones
    const myPowerUps = POWER_UPS.filter(p => player.selectedPowerUps.includes(p.id));

    // Dealing Animation Logic:
    // P1 Hand cards are indices 0-5. They should appear when dealingIndex >= 0..5
    // P2 Hand cards are indices 0-5. They should appear when dealingIndex >= 6..11
    
    // Calculate which cards should be visible
    const baseDealIndex = isLeft ? 0 : 6;
    
    return (
        <div className={`flex-1 flex flex-col relative p-4 transition-colors duration-300 ${isLeft ? 'border-r-[6px] border-black' : ''} ${isBonusPhase ? 'bg-yellow-100/50' : ''}`}>
             
             {/* Header Section: Stacked Name -> PowerUps -> Score */}
             <div className={`flex flex-col gap-2 mb-4 w-full ${isLeft ? 'items-start' : 'items-end'}`}>
                
                {/* Name Badge */}
                <div className="bg-yellow-300 px-6 py-2 rounded-xl border-[3px] border-yellow-500 shadow-sm z-20">
                    <span className="text-xl font-black uppercase tracking-tight text-gray-900">{player.name}</span>
                </div>
                
                {/* Power Up Row (Below Name) */}
                <div className="flex gap-2 z-30 my-1 min-h-[44px] items-center relative">
                    {myPowerUps.length > 0 ? (
                        myPowerUps.map(p => {
                            const isUsed = player.usedPowerUps.includes(p.id);
                            return (
                                <div key={p.id} className="relative group">
                                    <button 
                                        onClick={() => isMyTurn && !isUsed && activatePowerUp(p.id)}
                                        onMouseEnter={() => { playSfx('hover'); setHoveredPowerUp({ id: p.id, name: p.name, desc: p.description }); }}
                                        onMouseLeave={() => setHoveredPowerUp(null)}
                                        disabled={!isMyTurn || isUsed}
                                        className={`w-10 h-10 flex items-center justify-center rounded-full border-2 shadow-sm transition-all
                                            ${isUsed 
                                                ? 'bg-gray-300 border-gray-400 opacity-50 cursor-not-allowed' 
                                                : isMyTurn 
                                                    ? `${p.color} border-white text-white hover:scale-110 active:scale-95 cursor-pointer`
                                                    : `${p.color} border-white text-white opacity-80 cursor-default`
                                            }
                                        `}
                                    >
                                        {isUsed ? <Lock size={16} /> : React.cloneElement(p.icon as React.ReactElement<any>, { size: 18 })}
                                    </button>
                                    
                                    {/* Tooltip Overlay */}
                                    {hoveredPowerUp?.id === p.id && (
                                        <div className={`absolute bottom-full mb-2 w-48 bg-gray-900/95 backdrop-blur text-white text-xs p-3 rounded-xl shadow-xl z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 ${isLeft ? 'left-0' : 'right-0'}`}>
                                            <div className="font-black text-yellow-300 mb-1 text-sm uppercase">{hoveredPowerUp.name}</div>
                                            <div className="font-medium leading-tight text-gray-200">{hoveredPowerUp.desc}</div>
                                            <div className="absolute bottom-[-6px] left-4 w-3 h-3 bg-gray-900/95 rotate-45 transform"></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="h-10"></div> // Spacer
                    )}
                </div>

                {/* Score Badge */}
                <div className="bg-white/90 backdrop-blur-sm px-4 py-1 rounded-lg border-2 border-yellow-500 shadow-sm z-20">
                    <span className="text-lg font-bold text-gray-900">Score: {player.score}</span>
                </div>
             </div>

             {/* Turn Indicator Overlay */}
             {!isMyTurn && (
                <div className="absolute inset-0 bg-black/20 pointer-events-none z-10" />
             )}

             {/* Bonus Instruction */}
             {isBonusPhase && (
                 <div className="absolute top-36 left-0 right-0 text-center animate-bounce z-20 pointer-events-none">
                    <span className="bg-red-600 text-white px-4 py-2 rounded-full font-bold shadow-lg border-2 border-white">
                        LEMPAR KARTU BEBAS!
                    </span>
                 </div>
             )}

             {/* Hand */}
             <div className={`flex flex-wrap content-start gap-2 mt-auto relative z-10 ${isLeft ? 'justify-start' : 'justify-end'}`}>
                {player.hand.map((card, index) => {
                    // Check if dealt
                    const myDealIndex = baseDealIndex + index;
                    const isDealt = dealingIndex >= myDealIndex;
                    
                    if (!isDealt) return null; // Don't render if not dealt yet

                    return (
                        <Card 
                            key={card.id}
                            card={card}
                            onDragStart={(e, c) => handleDragStart(e, c, player.id)}
                            disabled={!isMyTurn}
                            // Add 'animate-deal' if it was just dealt
                            className={`transform transition-all duration-300 animate-deal
                                ${!isMyTurn ? 'opacity-70 grayscale-[0.5]' : ''} 
                                ${isBonusPhase ? 'ring-4 ring-red-500 scale-105' : 'hover:scale-105'}
                                ${highlightedCardId === card.id ? 'ring-8 ring-yellow-400 scale-110 -translate-y-4 z-50' : ''}
                            `}
                        />
                    );
                })}
             </div>
        </div>
    );
  };

  const renderGame = () => {
    return (
        <div className="flex flex-col h-screen w-full font-fredoka overflow-hidden select-none relative">
            
            {/* --- TOP SECTION (ARENA) --- */}
            <div className="h-[45%] bg-[#FFE4B5] relative border-b-[6px] border-black p-4 flex flex-col">
                 
                 {/* Header Text */}
                 <div className="absolute top-4 left-4 text-left pointer-events-none z-0 opacity-50 md:opacity-100">
                    <h2 className="text-2xl font-black text-gray-800 tracking-wider">KADU KASIK</h2>
                    <p className="text-sm font-bold text-gray-600">KARTU DUEL PERKALIAN ASYIK</p>
                 </div>

                 {/* Feedback Toast */}
                 {feedback && (
                    <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-8 py-4 rounded-2xl font-black text-xl shadow-2xl animate-in zoom-in fade-in slide-in-from-top-4 border-4 border-white text-center whitespace-nowrap ${
                        feedback.type === 'good' ? 'bg-green-500 text-white' : 
                        feedback.type === 'bad' ? 'bg-red-500 text-white' :
                        feedback.type === 'powerup' ? 'bg-purple-600 text-white' :
                        'bg-yellow-500 text-black'
                    }`}>
                        {feedback.msg}
                    </div>
                 )}

                 <div className="flex-1 flex items-center gap-4 relative mt-2 w-full max-w-7xl mx-auto">
                     
                     {/* Draw Pile (Left Side) */}
                     <div className="flex-shrink-0 flex flex-col items-center relative group z-20">
                        <div 
                            onClick={drawCard} 
                            onMouseEnter={() => playSfx('hover')}
                            className="cursor-pointer hover:-translate-y-2 transition-transform"
                        >
                            {gameState.drawPile.length > 0 ? (
                                <Card isFaceDown className="shadow-2xl" />
                            ) : (
                                <div className="w-24 h-36 border-4 border-dashed border-gray-400 rounded-xl flex items-center justify-center opacity-50 bg-white/50 font-bold text-red-500">
                                    <AlertCircle size={32} />
                                </div>
                            )}
                        </div>
                        <div className="mt-2 bg-white px-3 py-1 rounded-full font-bold shadow-sm border-2 border-gray-100">
                             Deck: {gameState.drawPile.length}
                        </div>
                     </div>

                     {/* Scrollable Arena Chain (Right Side) - DOMINO STYLE */}
                     <div 
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        className={`flex-1 h-full flex items-center bg-black/5 rounded-3xl border-4 border-dashed p-4 relative overflow-hidden ${gameState.isBonusTurn ? 'border-purple-500 bg-purple-100/50' : 'border-orange-400'}`}
                     >
                         <div className="absolute top-2 left-4 text-xs font-bold uppercase tracking-widest text-gray-500 pointer-events-none">
                             Area Melempar Kartu (Drag here)
                         </div>
                         
                         {/* Scrolling Container */}
                         <div 
                            ref={arenaScrollRef}
                            className="flex items-center gap-0 overflow-x-auto w-full h-full px-8 no-scrollbar pb-2"
                         >
                            {/* Ghost slot START */}
                            <div className="flex-shrink-0 w-8 h-24 border-4 border-dotted border-gray-300 rounded-xl flex items-center justify-center bg-white/30 mr-2 opacity-50">
                                <span className="text-xl text-gray-300 font-bold">&lt;</span>
                            </div>

                            {gameState.arenaCards.length === 0 ? (
                                <div className="w-full text-center text-gray-400 font-bold text-lg">
                                    Letakkan kartu disini
                                </div>
                            ) : (
                                gameState.arenaCards.map((card, index) => {
                                    // Arena card animation logic
                                    // The startArenaCard (index 0) should appear at dealingIndex 12
                                    const isDealt = index === 0 ? dealingIndex >= 12 : true;
                                    if (!isDealt) return null;

                                    return (
                                        <div key={`${card.id}-${index}`} className="flex-shrink-0 -ml-[2px] first:ml-0 shadow-lg relative z-10 transition-transform hover:z-20 hover:scale-105">
                                            <Card 
                                                card={card} 
                                                layout="horizontal" 
                                                flipOnMount={true}
                                                className={index === 0 ? 'animate-deal' : ''}
                                            />
                                        </div>
                                    )
                                })
                            )}
                            
                            {/* Ghost slot END */}
                            <div className="flex-shrink-0 w-8 h-24 border-4 border-dotted border-gray-300 rounded-xl flex items-center justify-center bg-white/30 ml-2 opacity-50">
                                <span className="text-xl text-gray-300 font-bold">&gt;</span>
                            </div>
                         </div>
                     </div>

                 </div>
            </div>

            {/* --- BOTTOM SECTION (PLAYERS) --- */}
            <div className="h-[55%] bg-[#AACCFF] flex w-full relative">
                {renderPlayerArea(gameState.player1, true)}
                {renderPlayerArea(gameState.player2, false)}
            </div>
        </div>
    );
  };

  const renderFinished = () => {
    if (!gameState.gameResult) return null;

    const { p1BaseScore, p1Penalty, p1FinalScore, p2BaseScore, p2Penalty, p2FinalScore, reason } = gameState.gameResult;
    const winnerName = gameState.winner === 'p1' ? gameState.player1.name : gameState.winner === 'p2' ? gameState.player2.name : "Seri";
    
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-yellow-100 z-50 font-fredoka relative overflow-hidden">
            
            {/* Confetti Elements (Simple CSS Dots) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => (
                    <div key={i} className="confetti absolute w-3 h-3 rounded-full opacity-0" style={{
                        left: `${Math.random() * 100}%`,
                        top: `-10%`,
                        backgroundColor: ['#ff0000', '#00ff00', '#0000ff', '#ffff00'][Math.floor(Math.random() * 4)],
                        animationDelay: `${Math.random() * 2}s`,
                        animationDuration: `${2 + Math.random() * 3}s`
                    }}></div>
                ))}
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-2xl text-center border-8 border-orange-500 animate-winner-pop max-w-2xl w-full relative z-10">
                <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-4 animate-bounce" />
                <h1 className="text-4xl font-black text-gray-800 mb-2 uppercase tracking-wide">
                    {gameState.winner === 'draw' ? "PERMAINAN SERI!" : `${winnerName} MENANG!`}
                </h1>
                
                <p className="text-gray-500 font-bold mb-6 uppercase">
                    {reason === 'deck_empty' ? "Kartu Deck Habis" : "Kartu Tangan Habis"}
                </p>
                
                {/* Detailed Scoreboard */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* Player 1 Card */}
                    <div className={`p-4 rounded-2xl border-2 ${gameState.winner === 'p1' ? 'bg-yellow-50 border-yellow-400' : 'bg-gray-50 border-gray-200'}`}>
                        <h3 className="font-black text-xl mb-2 text-gray-800">{gameState.player1.name}</h3>
                        <div className="space-y-1 text-sm font-medium text-gray-600">
                            <div className="flex justify-between">
                                <span>Skor Dasar:</span> <span>{p1BaseScore}</span>
                            </div>
                            <div className="flex justify-between text-red-500">
                                <span>Sisa Kartu ({p1Penalty}):</span> <span>-{p1Penalty}</span>
                            </div>
                            <div className="border-t pt-2 mt-2 flex justify-between font-black text-2xl text-gray-900">
                                <span>Total:</span> <span>{p1FinalScore}</span>
                            </div>
                        </div>
                    </div>

                    {/* Player 2 Card */}
                    <div className={`p-4 rounded-2xl border-2 ${gameState.winner === 'p2' ? 'bg-yellow-50 border-yellow-400' : 'bg-gray-50 border-gray-200'}`}>
                        <h3 className="font-black text-xl mb-2 text-gray-800">{gameState.player2.name}</h3>
                        <div className="space-y-1 text-sm font-medium text-gray-600">
                            <div className="flex justify-between">
                                <span>Skor Dasar:</span> <span>{p2BaseScore}</span>
                            </div>
                            <div className="flex justify-between text-red-500">
                                <span>Sisa Kartu ({p2Penalty}):</span> <span>-{p2Penalty}</span>
                            </div>
                             <div className="border-t pt-2 mt-2 flex justify-between font-black text-2xl text-gray-900">
                                <span>Total:</span> <span>{p2FinalScore}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <button 
                    onMouseEnter={() => playSfx('hover')}
                    onClick={() => {
                        playSfx('click');
                        setSetupStep('landing');
                        setP1Selection([]);
                        setP2Selection([]);
                        setP1Name("");
                        setP2Name("");
                        setSelectedDifficulty('medium');
                    }}
                    className="w-full py-4 bg-orange-500 text-white rounded-xl font-black text-xl hover:bg-orange-600 transition-colors shadow-lg border-b-4 border-orange-700 active:border-b-0 active:translate-y-1"
                >
                    MAIN LAGI
                </button>
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden text-gray-800 font-fredoka">
      {setupStep === 'landing' && renderLandingPage()}
      {setupStep === 'setup' && renderUnifiedSetup()}
      {setupStep === 'playing' && renderGame()}
      {setupStep === 'finished' && renderFinished()}
    </div>
  );
};

export default App;