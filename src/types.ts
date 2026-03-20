export type UserRole = 'Student' | 'Faculty' | 'Employee' | 'Admin';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  college_office: string;
  isSetupComplete: boolean;
  isBlocked: boolean;
}

export interface VisitorLog {
  id?: string;
  uid: string;
  timestamp: any; // Firestore Timestamp
  checkOutTime?: any; // Firestore Timestamp
  reason: string;
  userEmail: string;
  college_office: string;
  shortCode?: string; // 4-digit code for manual check-out
}

export const COLLEGES_OFFICES = [
  "College of Accountancy",
  "College of Agriculture",
  "College of Arts and Sciences",
  "College of Business Administration",
  "College of Communication",
  "College of Informatics and Computing Studies",
  "College of Criminology",
  "College of Education",
  "College of Engineering & Architecture",
  "College of Law",
  "College of Medical Technology",
  "College of Medicine",
  "College of Midwifery",
  "College of Music",
  "College of Nursing",
  "College of Physical Therapy",
  "College of Respiratory Therapy",
  "School of International Relations",
  "School of Graduate Studies",
  "Integrated School",
  "University Office",
  "Library Services",
  "Security Office",
  "Maintenance Office"
];

export const VISIT_REASONS = [
  'Reading',
  'Research',
  'Computer Use',
  'Studying',
  'Borrowing/Returning Books',
  'Other'
];
