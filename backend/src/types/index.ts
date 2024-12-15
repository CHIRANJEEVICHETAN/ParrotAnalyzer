import { Request } from 'express';

// Define all interfaces and types here
export interface JwtPayload {
  id: string;
  role: string;
  company_id?: string;
  iat?: number;
  exp?: number;
}

export interface CustomRequest extends Request {
  user?: {
    id: string;
    name?: string;
    email?: string;
    role: string;
    company_id?: string;
  };
  headers: Request['headers'] & {
    authorization?: string;
  };
  file?: any;
}

export interface ExpenseData {
  employeeName: string;
  employeeNumber: string;
  department: string;
  designation: string;
  location: string;
  date: string;
  vehicleType: string;
  vehicleNumber?: string;
  totalKilometers: string;
  startTime: string;
  endTime: string;
  routeTaken: string;
  lodgingExpenses: string;
  dailyAllowance: string;
  diesel: string;
  tollCharges: string;
  otherExpenses: string;
  advanceTaken: string;
  totalAmount: number;
  amountPayable: number;
  supportingDocs?: any[];
}

export interface ResetToken {
  email: string;
  token: string;
  expires: Date;
}

export interface CSVRow extends Array<string> {
  [index: number]: string;
}

export interface CSVHeaders {
  [key: string]: number;
}

export interface CSVRowData {
  name: string;
  email: string;
  phone: string;
  password: string;
  employee_number: string;
  department: string;
  designation: string;
  can_submit_expenses_anytime?: boolean;
}

export interface EmployeeData {
  name: string;
  employeeNumber: string;
  email: string;
  phone: string;
  password: string;
  department: string;
  designation: string;
  can_submit_expenses_anytime?: boolean;
}

export interface DatabaseError {
  code?: string;
  message?: string;
  detail?: string;
  stack?: string;
}

export type ParsedCSV = string[][]; 