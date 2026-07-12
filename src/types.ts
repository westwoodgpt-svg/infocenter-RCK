export interface FineItem {
  car: string;
  lastFine: string; // ISO date string or similar format "YYYY-MM-DD"
}

export interface EventItem {
  name: string;
  date: string; // "YYYY-MM-DD"
}

export interface NpsGroup {
  companies: string[];
  dates: string[];
  fact: number[];
  goal: number;
}

export interface NpsTreningiGroup {
  names: string[];
  fact: number[];
  goal: number;
}

export interface ProductionProgress {
  plan: number[];
  gotovitsya: (number | null)[];
  gotov: (number | null)[];
}

export interface ProductionProjects {
  plan: number[];
  otkryto: (number | null)[];
  zakryto: (number | null)[];
}

export interface ProductionEdu {
  plan: number[];
  fact: (number | null)[];
}

export interface ProductionSmi {
  weeks: string[];
  plan: number[];
  fact: (number | null)[];
}

export interface Smeta {
  total: number;
  contractedNotSpent: number;
  spent: number;
  notContracted: number;
}

export interface PersonnelRatio {
  plan: number;
  fact: number;
}

export interface RckDashboardData {
  updated: string;
  fines: FineItem[];
  certification: string;
  events: EventItem[];
  npsFabrika: NpsGroup;
  npsFabrikaOfis: NpsGroup;
  npsTreningi: NpsTreningiGroup;
  ibp: ProductionProgress;
  projects: ProductionProjects;
  edu: ProductionEdu;
  smi: ProductionSmi;
  smeta: Smeta;
  rck: PersonnelRatio;
  cuppp: PersonnelRatio;
}

export type TabId = 'security' | 'quality' | 'production' | 'costs' | 'personnel';
