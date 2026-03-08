
export enum UserRole {
  Clerk = 'Clerk',
  Admin = 'Admin',
  Officer = 'Officer',
  None = 'None'
}

export enum ApplicationStatus {
  Pending = 'Pending Review',
  Approved = 'Approved',
  Rejected = 'Rejected',
  InfoRequested = 'More Info Requested',
}

export enum ApplicationType {
    NewLicense = "New Driver's License",
    NewVehicle = "New Vehicle Registration",
    Renewal = "License Renewal",
}

export interface Application {
  id: string;
  applicantName: string; // Combined for display, or First/Last separate
  firstName?: string;
  lastName?: string;
  gender?: string;
  phone?: string;
  email?: string;
  type: ApplicationType;
  submittedDate: string;
  status: ApplicationStatus;
  // Details for the review screen
  details?: {
    dob: string;
    address: string;
    documents: { name: string; url: string }[];
    testResults: { test: string; score: number; passed: boolean }[];
    notes: string[];
  }
}

// Payment Interface
export interface Payment {
  id: string; // Receipt Number
  payerName: string;
  serviceType: 'vehicle_registration' | 'license_fee' | 'plate_fee' | 'renewal_fee' | 'traffic_fine';
  amount: number;
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'mobile_money' | 'cheque';
  date: string;
  notes?: string;
}

// Plate Stock Interface
export interface PlateItem {
  plateNumber: string;
  type: 'private' | 'commercial' | 'government' | 'diplomatic';
  dateReceived: string;
  status: 'available' | 'assigned' | 'lost' | 'defaced';
  notes?: string;
}

// Vehicle Registry Interface
export interface Vehicle {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
    year: number;
    ownerName: string;
    ownerPhone: string;
    type: 'private' | 'commercial' | 'motorcycle' | 'truck' | 'bus';
    status: 'Active' | 'Expired' | 'Suspended' | 'Stolen';
    expiryDate: string;
    stolen_status?: {
        isStolen: boolean;
        reportedAt?: string;
        reportedBy?: string;
    };
}

// Driver Registry Interface
export interface Driver {
    id: string;
    licenseNumber: string;
    fullName: string;
    phone: string;
    email: string;
    gender: 'Male' | 'Female';
    status: 'Active' | 'Expired' | 'Suspended';
    expiryDate: string;
    associatedVehicles: string[]; // Plate numbers
}

// Violation Interface
export interface Violation {
    id: string;
    violationType: string;
    driverName: string;
    licenseNumber: string;
    plateNumber: string;
    amount: number;
    amountPaid: number;
    issueDate: string;
    dueDate: string;
    status: 'Paid' | 'Unpaid' | 'Overdue' | 'Partial';
    paymentHistory: {
        amount: number;
        date: string;
        method: string;
        transactionId: string;
    }[];
}

// For Universal Search
export interface SearchResult {
    id: string;
    type: 'Vehicle' | 'Driver' | 'Application';
    title: string;
    subtitle: string;
}

export type ProfileData = SearchResult;

export type User = {
    id: string;
    name: string;
    username: string;
    email?: string;
    role: UserRole;
    lastLogin: string;
    password?: string;
    status: 'Active' | 'Inactive';
    canAccessWeb: boolean;
    canAccessMobile: boolean;
}

export interface SystemFees {
    newLicenseFee: number;
    licenseRenewalFee: number;
    vehicleRegistrationFee: number;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    user: string;
    role: string;
    action: string;
    details: string;
    ipAddress: string;
    status: 'success' | 'failure';
}

export interface Alert {
    id: string;
    category: 'System' | 'BOLO';
    type?: string;
    title: string;
    description?: string;
    priority: 'High' | 'Medium' | 'Low';
    location?: string;
    metadata?: Record<string, any>;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
