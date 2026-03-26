export interface DSAData {
  completed: boolean;
  topic: string;
  count: number;
}

export interface GymData {
  completed: boolean;
  type: 'gym' | 'steps';
  steps: number;
  progress: string;
}

export interface LearningData {
  completed: boolean;
  concept: string;
  documentation: string;
}

export interface DailyLog {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  dsa: DSAData;
  gym: GymData;
  learning: LearningData;
  allCompleted: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: any;
}
