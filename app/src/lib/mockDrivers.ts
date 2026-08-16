export interface MockDriver {
  id: string;
  name: string;
  vehicle: string;
  adOptedIn: boolean;
}

export const mockDrivers: MockDriver[] = [
  { id: "d1", name: "Rakesh Kumar", vehicle: "Bajaj Maxima · WB 12 AB 1234", adOptedIn: true },
  { id: "d2", name: "Anjali Sharma", vehicle: "Piaggio Ape · WB 06 CD 5678", adOptedIn: true },
  { id: "d3", name: "Vikash Singh", vehicle: "Mahindra Treo · WB 02 GH 1122", adOptedIn: false },
  { id: "d4", name: "Sohail Khan", vehicle: "Bajaj RE · WB 14 KL 9988", adOptedIn: true },
  { id: "d5", name: "Priti Das", vehicle: "TVS King · WB 09 XY 4433", adOptedIn: false },
];

// The driver identity used by the Driver portal's own screens in this demo (DriverDashboard, DriverAdOptIn, etc).
export const CURRENT_DRIVER_ID = "d1";
