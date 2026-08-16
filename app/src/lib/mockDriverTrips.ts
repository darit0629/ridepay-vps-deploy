export type TripPaymentMethod = "Cash" | "UPI";
export type TripStatus = "Completed" | "Cancelled";

export interface DriverTrip {
  id: number;
  from: string;
  to: string;
  date: string;
  type: "Share" | "Reserve";
  amount: number;
  status: TripStatus;
  distanceKm: number;
  durationMin: number;
  paymentMethod: TripPaymentMethod;
  passengerName: string;
  passengerRating: number;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
}

export const driverTrips: DriverTrip[] = [
  {
    id: 1, from: "Station Road", to: "Naihati Bus Stand", date: "10 May, 2024 - 09:30 PM", type: "Share", amount: 70,
    status: "Completed", distanceKm: 8.6, durationMin: 22, paymentMethod: "Cash",
    passengerName: "Anjali Sharma", passengerRating: 5,
    pickup: { lat: 22.69, lng: 88.37 }, dropoff: { lat: 22.735, lng: 88.42 },
  },
  {
    id: 2, from: "Ranaghat", to: "Krishnanagar", date: "10 May, 2024 - 08:15 PM", type: "Reserve", amount: 120,
    status: "Completed", distanceKm: 14.2, durationMin: 34, paymentMethod: "UPI",
    passengerName: "Rahul Verma", passengerRating: 4,
    pickup: { lat: 23.179, lng: 88.559 }, dropoff: { lat: 23.4, lng: 88.48 },
  },
  {
    id: 3, from: "Ranaghat Market", to: "College More", date: "10 May, 2024 - 07:10 PM", type: "Share", amount: 35,
    status: "Completed", distanceKm: 2.8, durationMin: 9, paymentMethod: "Cash",
    passengerName: "Priti Das", passengerRating: 5,
    pickup: { lat: 23.178, lng: 88.5585 }, dropoff: { lat: 23.1745, lng: 88.5605 },
  },
  {
    id: 4, from: "Hospital Road", to: "Station Road", date: "10 May, 2024 - 05:45 PM", type: "Share", amount: 25,
    status: "Completed", distanceKm: 1.9, durationMin: 6, paymentMethod: "UPI",
    passengerName: "Subhajit Roy", passengerRating: 5,
    pickup: { lat: 23.1795, lng: 88.5635 }, dropoff: { lat: 22.69, lng: 88.37 },
  },
  {
    id: 5, from: "Naihati", to: "Kalyani", date: "09 May, 2024 - 03:00 PM", type: "Reserve", amount: 150,
    status: "Completed", distanceKm: 18.4, durationMin: 41, paymentMethod: "Cash",
    passengerName: "Sohail Khan", passengerRating: 4,
    pickup: { lat: 22.735, lng: 88.42 }, dropoff: { lat: 22.975, lng: 88.435 },
  },
];
