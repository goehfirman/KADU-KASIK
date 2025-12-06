import React from 'react';
import { MathCard } from '../types';
import { Zap } from 'lucide-react';

interface CardProps {
  card?: MathCard;
  isFaceDown?: boolean;
  onDragStart?: (e: React.DragEvent, card: MathCard) => void;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  flipOnMount?: boolean;
  layout?: 'vertical' | 'horizontal'; // New prop for visual style
}

export const Card: React.FC<CardProps> = ({ 
  card, 
  isFaceDown,
  onDragStart, 
  onClick,
  disabled,
  className = "",
  flipOnMount = false,
  layout = 'vertical'
}) => {
  
  const animationClass = flipOnMount ? 'animate-flip-in' : '';

  // Back of card (Deck visual) - Always vertical aspect ratio for deck/hand usually, 
  // but if needed in arena we could handle it. For now assuming deck is vertical.
  if (isFaceDown) {
    return (
       <div className={`w-24 h-36 sm:w-28 sm:h-40 rounded-xl border-[4px] border-yellow-500 bg-red-600 shadow-md flex items-center justify-center ${className} ${animationClass}`}>
         <div className="w-16 h-16 rounded-full border-4 border-yellow-400 opacity-50 flex items-center justify-center">
            <div className="w-8 h-8 bg-yellow-400 rounded-sm rotate-45"></div>
         </div>
       </div>
    );
  }

  if (!card) return null;

  // Wild Card Visual
  if (card.type === 'wild') {
    const sizeClasses = layout === 'horizontal' 
        ? 'w-40 h-24 sm:w-48 sm:h-28' 
        : 'w-24 h-36 sm:w-28 sm:h-40 md:w-32 md:h-44';

    return (
      <div 
        className={`relative group flex items-center justify-center ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:-translate-y-1'} transition-transform duration-200 ${className} ${animationClass}`}
        draggable={!disabled}
        onDragStart={(e) => !disabled && onDragStart && onDragStart(e, card)}
        onClick={onClick}
      >
        <div className={`${sizeClasses} rounded-xl overflow-hidden border-[4px] border-yellow-400 shadow-[0_4px_0_rgb(0,0,0,0.15)] bg-red-600 select-none flex flex-col items-center justify-center`}>
          <div className="animate-pulse">
            <Zap className="w-12 h-12 text-yellow-300 fill-yellow-300 stroke-[3]" />
          </div>
          <span className="text-white font-black text-sm mt-1 uppercase tracking-wider">Bonus</span>
        </div>
      </div>
    );
  }

  // Normal Card Visual
  const isHorizontal = layout === 'horizontal';

  return (
    <div 
      className={`relative group flex ${disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:-translate-y-1'} transition-transform duration-200 ${className} ${animationClass}`}
      draggable={!disabled}
      onDragStart={(e) => !disabled && onDragStart && onDragStart(e, card)}
      onClick={onClick}
    >
      {/* The Physical Card */}
      <div className={`
        ${isHorizontal ? 'w-40 h-24 sm:w-48 sm:h-28 flex-row' : 'w-24 h-36 sm:w-28 sm:h-40 md:w-32 md:h-44 flex-col'}
        rounded-xl overflow-hidden border-[4px] border-yellow-400 shadow-[0_4px_0_rgb(0,0,0,0.15)] bg-white select-none flex
      `}>
        
        {/* Section A: Question */}
        {/* Vertical: Top (Red). Horizontal: Left (Red) */}
        <div className={`
            ${isHorizontal ? 'w-[55%] h-full border-r-[3px] border-yellow-400' : 'h-[55%] w-full border-b-[3px] border-yellow-400'}
            bg-[#D50000] flex items-center justify-center relative
        `}>
          <span className={`${isHorizontal ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'} text-white font-bold tracking-tight drop-shadow-sm font-fredoka`}>
            {card.question}
          </span>
        </div>

        {/* Section B: Answer */}
        {/* Vertical: Bottom (White). Horizontal: Right (White) */}
        <div className={`
            ${isHorizontal ? 'w-[45%] h-full' : 'h-[45%] w-full'}
            bg-white flex items-center justify-center relative
        `}>
          <span className={`${isHorizontal ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl'} text-black font-bold tracking-tighter font-fredoka`}>
            {card.answerDisplay}
          </span>
        </div>
      </div>
    </div>
  );
};