import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'employee';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  active: boolean;
  role: Role;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type LayoutStatus = 'draft' | 'published' | 'archived';

export interface OfficeLayout {
  id: string;
  name: string;
  office: string;
  floor: string;
  imageBase64: string;
  imageMimeType: string;
  imageWidth: number;
  imageHeight: number;
  imageSizeBytes: number;
  status: LayoutStatus;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  publishedAt: Timestamp | null;
}

export interface Seat {
  id: string;
  seatCode: string;
  label: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  enabled: boolean;
  zone: string;
  department: string;
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type BookingStatus = 'active' | 'cancelled';

export interface Booking {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  layoutId: string;
  seatId: string;
  seatCode: string;
  bookingDate: string; // YYYY-MM-DD
  status: BookingStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AppSettings {
  advanceBookingDays: number;
  maxBookingsPerDay: number;
  cancellationDeadlineHours: number;
  workingDays: number[]; // 0 = Sunday ... 6 = Saturday
}

export const DEFAULT_SETTINGS: AppSettings = {
  advanceBookingDays: 14,
  maxBookingsPerDay: 1,
  cancellationDeadlineHours: 2,
  workingDays: [1, 2, 3, 4, 5],
};

export const ADMIN_EMAIL = 'admin@officeseat.demo';
export const MAX_IMAGE_BASE64_CHARS = 700_000;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
