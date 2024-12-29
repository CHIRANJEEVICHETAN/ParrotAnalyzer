import { Ionicons } from '@expo/vector-icons';

export type ReportType = 'expense' | 'attendance' | 'task' | 'travel' | 'performance' | 'leave';
export type IconName = keyof typeof Ionicons.glyphMap;

export interface ReportAnalytics {
  total: number;
  trend: string;
  average: number;
  lastUpdated: string;
}

export interface ReportSection {
  type: ReportType;
  title: string;
  icon: IconName;
  analytics: ReportAnalytics;
  color: string;
}

export interface Report {
  id: number;
  type: ReportType;
  title: string;
  date: string;
  amount: number | null;
  status: string | null;
} 