export type RideStatus = "Ongoing" | "Completed" | "Cancelled";
export type RideType = "Share" | "Reserve";
export type RidePaymentMethod = "UPI" | "Cash";

export interface RideRecord {
  id: string;
  user: string;
  userPhone: string;
  driver: string;
  driverPhone: string;
  from: string;
  to: string;
  fare: number;
  status: RideStatus;
  type: RideType;
  paymentMethod: RidePaymentMethod;
  date: string;
  distanceKm: number;
  durationMin: number;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
}

export const rides: RideRecord[] = [
  {
    id: "#RID12345",
    user: "Anjali Sharma",
    userPhone: "+91 98765 43210",
    driver: "Rakesh Kumar",
    driverPhone: "+91 98765 43210",
    from: "Station Road",
    to: "Naihati Bus Stand",
    fare: 70,
    status: "Ongoing",
    type: "Share",
    paymentMethod: "UPI",
    date: "20 May, 2024",
    distanceKm: 8.4,
    durationMin: 22,
    pickup: { lat: 22.69, lng: 88.37 },
    dropoff: { lat: 22.72, lng: 88.42 },
  },
  {
    id: "#RID12344",
    user: "Rahul Verma",
    userPhone: "+91 91234 56789",
    driver: "Anjali Sharma",
    driverPhone: "+91 91234 56789",
    from: "Ranaghat",
    to: "Krishnanagar",
    fare: 120,
    status: "Completed",
    type: "Reserve",
    paymentMethod: "UPI",
    date: "19 May, 2024",
    distanceKm: 24.1,
    durationMin: 48,
    pickup: { lat: 23.178, lng: 88.5605 },
    dropoff: { lat: 23.4, lng: 88.48 },
  },
  {
    id: "#RID12343",
    user: "Priti Das",
    userPhone: "+91 99011 22334",
    driver: "Sohail Khan",
    driverPhone: "+91 99011 22334",
    from: "Ranaghat Market",
    to: "College More",
    fare: 35,
    status: "Completed",
    type: "Share",
    paymentMethod: "Cash",
    date: "18 May, 2024",
    distanceKm: 3.2,
    durationMin: 11,
    pickup: { lat: 22.695, lng: 88.365 },
    dropoff: { lat: 22.71, lng: 88.39 },
  },
  {
    id: "#RID12342",
    user: "Subhajit Roy",
    userPhone: "+91 87776 54321",
    driver: "Vikash Singh",
    driverPhone: "+91 87776 54321",
    from: "Hospital Road",
    to: "Station Road",
    fare: 25,
    status: "Cancelled",
    type: "Share",
    paymentMethod: "Cash",
    date: "17 May, 2024",
    distanceKm: 1.8,
    durationMin: 6,
    pickup: { lat: 22.688, lng: 88.372 },
    dropoff: { lat: 22.69, lng: 88.37 },
  },
  {
    id: "#RID12341",
    user: "Anjali Sharma",
    userPhone: "+91 98765 43210",
    driver: "Pooja Das",
    driverPhone: "+91 87654 32109",
    from: "Naihati",
    to: "Kalyani",
    fare: 150,
    status: "Completed",
    type: "Reserve",
    paymentMethod: "UPI",
    date: "16 May, 2024",
    distanceKm: 30.5,
    durationMin: 55,
    pickup: { lat: 22.9, lng: 88.42 },
    dropoff: { lat: 22.975, lng: 88.434 },
  },
];

export const rideStatusConfig: Record<RideStatus, { label: string; color: string; bg: string }> = {
  Ongoing: { label: "Ongoing", color: "#FF6B00", bg: "#FFF5EB" },
  Completed: { label: "Completed", color: "#138808", bg: "#E8F5E8" },
  Cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" },
};
