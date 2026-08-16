export type DriverStatus = "approved" | "pending" | "blocked";
export type DocStatus = "verified" | "pending";
export type PaymentMethod = "UPI" | "Cash";

export interface DriverDocument {
  type: string;
  status: DocStatus;
  number: string;
}

export interface DriverBankDetails {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export interface DriverTrip {
  id: string;
  date: string;
  from: string;
  to: string;
  fare: number;
  paymentMethod: PaymentMethod;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
}

export interface DriverProfile {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  vehicle: string;
  plate: string;
  status: DriverStatus;
  rides: number;
  bank: DriverBankDetails;
  documents: DriverDocument[];
  earnings: { total: number; thisMonth: number };
  recentTrips: DriverTrip[];
}

export const driverProfiles: DriverProfile[] = [
  {
    id: 1,
    name: "Rakesh Kumar",
    phone: "+91 98765 43210",
    email: "rakesh.kumar@example.com",
    address: "Station Road, Ranaghat, Nadia, WB 741201",
    vehicle: "Bajaj Maxima",
    plate: "WB 12 AB 1234",
    status: "approved",
    rides: 18,
    bank: { accountHolder: "Rakesh Kumar", accountNumber: "XXXXXXXX4821", ifsc: "SBIN0001234", bankName: "State Bank of India" },
    documents: [
      { type: "Driving License", status: "verified", number: "WB-0120230012345" },
      { type: "Vehicle RC", status: "verified", number: "WB12AB1234-RC" },
      { type: "Insurance", status: "verified", number: "INS-887654321" },
      { type: "Aadhaar Card", status: "verified", number: "XXXX XXXX 4821" },
    ],
    earnings: { total: 48200, thisMonth: 12600 },
    recentTrips: [
      { id: "#RID12345", date: "20 May, 2024", from: "Station Road", to: "Naihati Bus Stand", fare: 70, paymentMethod: "UPI", pickup: { lat: 22.69, lng: 88.37 }, dropoff: { lat: 22.72, lng: 88.42 } },
      { id: "#RID12290", date: "19 May, 2024", from: "Ranaghat Market", to: "College More", fare: 35, paymentMethod: "Cash", pickup: { lat: 22.695, lng: 88.365 }, dropoff: { lat: 22.71, lng: 88.39 } },
      { id: "#RID12211", date: "18 May, 2024", from: "Hospital Road", to: "Station Road", fare: 25, paymentMethod: "UPI", pickup: { lat: 22.688, lng: 88.372 }, dropoff: { lat: 22.69, lng: 88.37 } },
    ],
  },
  {
    id: 2,
    name: "Anjali Sharma",
    phone: "+91 91234 56789",
    email: "anjali.sharma.driver@example.com",
    address: "College More, Ranaghat, Nadia, WB 741201",
    vehicle: "Bajaj RE",
    plate: "WB 06 CD 5678",
    status: "approved",
    rides: 15,
    bank: { accountHolder: "Anjali Sharma", accountNumber: "XXXXXXXX2290", ifsc: "HDFC0002345", bankName: "HDFC Bank" },
    documents: [
      { type: "Driving License", status: "verified", number: "WB-0120220054321" },
      { type: "Vehicle RC", status: "verified", number: "WB06CD5678-RC" },
      { type: "Insurance", status: "pending", number: "INS-112233445" },
      { type: "Aadhaar Card", status: "verified", number: "XXXX XXXX 2290" },
    ],
    earnings: { total: 39500, thisMonth: 10200 },
    recentTrips: [
      { id: "#RID12344", date: "20 May, 2024", from: "Ranaghat", to: "Krishnanagar", fare: 120, paymentMethod: "UPI", pickup: { lat: 23.178, lng: 88.5605 }, dropoff: { lat: 23.4, lng: 88.48 } },
      { id: "#RID12301", date: "19 May, 2024", from: "Kalyani", to: "Ranaghat", fare: 90, paymentMethod: "Cash", pickup: { lat: 22.975, lng: 88.434 }, dropoff: { lat: 23.178, lng: 88.5605 } },
    ],
  },
  {
    id: 3,
    name: "Sohail Khan",
    phone: "+91 99011 22334",
    email: "sohail.khan@example.com",
    address: "Kalyani, Nadia, WB 741235",
    vehicle: "TVS King",
    plate: "WB 14 EF 9101",
    status: "pending",
    rides: 0,
    bank: { accountHolder: "Sohail Khan", accountNumber: "XXXXXXXX7745", ifsc: "ICIC0003456", bankName: "ICICI Bank" },
    documents: [
      { type: "Driving License", status: "pending", number: "WB-0120240098765" },
      { type: "Vehicle RC", status: "pending", number: "WB14EF9101-RC" },
      { type: "Insurance", status: "pending", number: "INS-556677889" },
      { type: "Aadhaar Card", status: "verified", number: "XXXX XXXX 7745" },
    ],
    earnings: { total: 0, thisMonth: 0 },
    recentTrips: [],
  },
  {
    id: 4,
    name: "Vikash Singh",
    phone: "+91 87776 54321",
    email: "vikash.singh@example.com",
    address: "Krishnanagar, Nadia, WB 741101",
    vehicle: "Piaggio Ape",
    plate: "WB 02 GH 1122",
    status: "approved",
    rides: 12,
    bank: { accountHolder: "Vikash Singh", accountNumber: "XXXXXXXX3312", ifsc: "PUNB0004567", bankName: "Punjab National Bank" },
    documents: [
      { type: "Driving License", status: "verified", number: "WB-0120210011223" },
      { type: "Vehicle RC", status: "verified", number: "WB02GH1122-RC" },
      { type: "Insurance", status: "verified", number: "INS-334455667" },
      { type: "Aadhaar Card", status: "verified", number: "XXXX XXXX 3312" },
    ],
    earnings: { total: 28900, thisMonth: 7400 },
    recentTrips: [
      { id: "#RID12180", date: "17 May, 2024", from: "Ranaghat College", to: "Home", fare: 40, paymentMethod: "Cash", pickup: { lat: 23.174, lng: 88.5605 }, dropoff: { lat: 23.178, lng: 88.55 } },
    ],
  },
  {
    id: 5,
    name: "Pooja Das",
    phone: "+91 87654 32109",
    email: "pooja.das@example.com",
    address: "Naihati, North 24 Parganas, WB 743165",
    vehicle: "Bajaj Maxima",
    plate: "WB 20 IJ 3344",
    status: "blocked",
    rides: 8,
    bank: { accountHolder: "Pooja Das", accountNumber: "XXXXXXXX9981", ifsc: "AXIS0005678", bankName: "Axis Bank" },
    documents: [
      { type: "Driving License", status: "verified", number: "WB-0120190033445" },
      { type: "Vehicle RC", status: "verified", number: "WB20IJ3344-RC" },
      { type: "Insurance", status: "verified", number: "INS-998877665" },
      { type: "Aadhaar Card", status: "verified", number: "XXXX XXXX 9981" },
    ],
    earnings: { total: 15600, thisMonth: 0 },
    recentTrips: [
      { id: "#RID11980", date: "10 May, 2024", from: "Naihati", to: "Kalyani", fare: 150, paymentMethod: "UPI", pickup: { lat: 22.9, lng: 88.42 }, dropoff: { lat: 22.975, lng: 88.434 } },
    ],
  },
];

export const driverStatusConfig: Record<DriverStatus, { label: string; color: string; bg: string }> = {
  approved: { label: "Approved", color: "#138808", bg: "#E8F5E8" },
  pending: { label: "Pending", color: "#FF6B00", bg: "#FFF5EB" },
  blocked: { label: "Blocked", color: "#DC2626", bg: "#FEE2E2" },
};

export const docStatusConfig: Record<DocStatus, { label: string; color: string; bg: string }> = {
  verified: { label: "Verified", color: "#138808", bg: "#E8F5E8" },
  pending: { label: "Pending", color: "#FF6B00", bg: "#FFF5EB" },
};
