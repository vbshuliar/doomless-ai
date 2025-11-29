// Placeholder client for the future Cactus SDK integration.
// These types and functions sketch the contract we expect once on-device models are wired up.
import type { CategoryId } from '../types/categories';
import type { BrainProfile } from '../types/brain';

export type AIRewriteRequest = {
  originalText: string;
  category: CategoryId;
  difficulty: 'easy' | 'medium' | 'hard';
  userProfile: BrainProfile;
};

export type AIRewriteResponse = {
  rewrittenText: string;
};

export type AIQuizGenerationRequest = {
  sourceText: string;
  category: CategoryId;
};

export type AIQuizGenerationResponse = {
  question: string;
  options: string[];
  correctIndex: number;
};

export async function rewriteFactForUser(
  request: AIRewriteRequest,
): Promise<AIRewriteResponse> {
  // TODO: Replace with Cactus SDK call (e.g., Gemma3-1B-Instruct) for personalized rewriting.
  // For now, we simply echo the original text so the rest of the app behaves deterministically.
  return {
    rewrittenText: request.originalText,
  };
}

export async function generateQuizForFact(
  request: AIQuizGenerationRequest,
): Promise<AIQuizGenerationResponse> {
  // TODO: Replace with Cactus SDK call (e.g., locally hosted quiz generator) once available.
  // Presently we return a trivial placeholder quiz so downstream code has an extension point.
  return {
    question: `What is a memorable detail about: "${request.sourceText}"?`,
    options: ['The fact stays the same', 'AI support coming soon', 'Personalized quiz pending', 'All of the above'],
    correctIndex: 3,
  };
}
