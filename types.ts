
export interface User {
  id: string;
  empId: string; // New field for employee identification
  name: string;
  email: string;
  password?: string;
}

export interface TimeData {
  id: string;
  date: string;
  pause: string; // HH:MM:SS
  dispo: string; // HH:MM:SS
  dead: string;  // HH:MM:SS
  currentLogin: string; // HH:MM:SS
  wait: string;
  talk: string;
  hold: string;
  customerTalk: string;
  inbound: number;
  outbound: number;
}

export interface AIExtractionLog {
  id: string;
  timestamp: string;
  rawText: string;
  parsedData: Omit<TimeData, 'id' | 'date'>;
}

export interface CalculationResult {
  totalPauseTime: string;
  loginRemaining: string;
  breakRemaining: string;
  breakUsedSeconds: number;
  breakLeftSeconds: number;
  loginRemainingSeconds: number;
  totalBreakSeconds: number;
}
