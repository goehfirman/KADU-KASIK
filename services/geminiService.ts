import { GoogleGenAI, Type } from "@google/genai";
import { MathCard } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateMathLoop = async (count: number, difficulty: string, topic?: string): Promise<MathCard[]> => {
  // Ensure we have at least enough cards for P1(6) + P2(6) + Arena(1) + Buffer. 
  // User requested 14 total.
  const targetCount = Math.max(count, 14); 
  const modelId = "gemini-2.5-flash";
  
  let difficultyRules = "";
  if (topic) {
      difficultyRules = `Focus strictly on this topic: ${topic}`;
  } else {
      switch(difficulty.toLowerCase()) {
          case 'easy':
              difficultyRules = "Strictly 1-digit x 1-digit multiplication (factors must be between 2-9). No 2-digit numbers allowed as factors.";
              break;
          case 'medium':
              difficultyRules = "Strictly 1-digit x 2-digit multiplication (one factor must be 2-9, the other must be 10-99).";
              break;
          case 'hard':
              difficultyRules = "Strictly 2-digit x 2-digit multiplication (both factors must be 10-99).";
              break;
          default:
              difficultyRules = "Generate multiplication problems appropriate for primary school.";
      }
  }
  
  const prompt = `
    Create a circular "I Have, Who Has" math loop game with ${targetCount} cards.
    Constraint: ${difficultyRules}
    
    Rules:
    1. Each card has a "question" (multiplication problem) and a "bottomNumber" (integer).
    2. The "bottomNumber" of Card N must be the answer to the "question" of Card N+1.
    3. The "bottomNumber" of the Last Card must be the answer to the "question" of the First Card.
    4. Provide the list in the correct solution order.
    
    Output JSON format:
    Array of objects: { "question": "string (e.g. 4 x 5)", "questionValue": number, "bottomNumber": number }
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              questionValue: { type: Type.NUMBER },
              bottomNumber: { type: Type.NUMBER },
            },
            required: ["question", "questionValue", "bottomNumber"],
          },
        },
      },
    });

    const data = JSON.parse(response.text || "[]");
    
    // Transform to our internal type and add IDs
    return data.map((item: any, index: number) => ({
      id: `card-${Date.now()}-${index}`,
      question: item.question.replace('*', '×').replace('x', '×'),
      questionValue: item.questionValue,
      answerDisplay: item.bottomNumber,
      type: 'normal'
    }));
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    // Fallback to static generation if API fails
    return generateStaticLevel(targetCount, difficulty);
  }
};

export const getHint = async (hand: MathCard[], targetNumber: number): Promise<string> => {
  const modelId = "gemini-2.5-flash";
  
  // Prepare a representation of the current state
  const cardsStr = hand.map(c => `[${c.question} = ?]`).join(", ");
  
  const prompt = `
    The player needs to find a card in their hand where the math problem equals ${targetNumber}.
    Hand: ${cardsStr}.
    If they have a match, give a hint like "Look for a problem that equals ${targetNumber}".
    If they don't have a match, say "No match here, draw a card!".
    Keep it under 15 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "Check your math!";
  } catch (error) {
    return "Find a card where the top question equals the center bottom number!";
  }
};

// Fallback generator
const generateStaticLevel = (count: number, difficulty: string = 'medium'): MathCard[] => {
  const pairs: {q: string, v: number}[] = [];
  
  for(let i=0; i<count; i++) {
    let a = 0;
    let b = 0;

    if (difficulty.toLowerCase() === 'easy') {
        a = Math.floor(Math.random() * 8) + 2; // 2 to 9
        b = Math.floor(Math.random() * 8) + 2; // 2 to 9
    } else if (difficulty.toLowerCase() === 'medium') {
        // 1 digit x 2 digit (Random order)
        const single = Math.floor(Math.random() * 8) + 2; // 2 to 9
        const double = Math.floor(Math.random() * 90) + 10; // 10 to 99
        if (Math.random() > 0.5) {
             a = single; b = double;
        } else {
             a = double; b = single;
        }
    } else if (difficulty.toLowerCase() === 'hard') {
        // 2 digit x 2 digit
        a = Math.floor(Math.random() * 90) + 10;
        b = Math.floor(Math.random() * 90) + 10; 
    } else {
        // Fallback default
        a = Math.floor(Math.random() * 9) + 2;
        b = Math.floor(Math.random() * 9) + 2;
    }

    pairs.push({ q: `${a} × ${b}`, v: a * b });
  }

  // Create the loop: Card[i].bottom = Card[i+1].value
  const cards: MathCard[] = pairs.map((pair, index) => {
    const nextIndex = (index + 1) % count;
    return {
      id: `static-${index}`,
      question: pair.q,
      questionValue: pair.v,
      answerDisplay: pairs[nextIndex].v, // The bottom number answers the NEXT card
      type: 'normal'
    };
  });

  return cards;
};