export interface Paragraph {
  index: number;
  text: string;
  html?: string;
}

export interface Section {
  title: string;
  start_paragraph_index: number;
  end_paragraph_index: number;
}

export interface BookMetadata {
  book_id: string;
  title: string;
  author?: string;
  cover?: string;
}

export interface ReadingState {
  current_paragraph_index: number;
  unlocked_until_index: number;
  last_quiz_gate_index: number;
  n_used: number;
}

export interface Settings {
  n: number;
  question_count_preference: number;
  pass_threshold: number;
  openai_api_key: string;
}

export interface QuizState {
  gate_index: number;
  questions: Array<{
    id: string;
    question: string;
    answers: string[];
    correct_index: number;
  }>;
  answers: Record<string, number>;
  completed: boolean;
}

