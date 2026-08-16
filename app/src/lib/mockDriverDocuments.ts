export type DocStatus = "valid" | "expiring" | "pending";

export interface DriverDocument {
  label: string;
  expiry: string;
  status: DocStatus;
}

export const initialDriverDocuments: DriverDocument[] = [
  { label: "Insurance", expiry: "15 Dec 2026", status: "valid" },
  { label: "RC (Registration Certificate)", expiry: "No expiry", status: "valid" },
  { label: "Driving License", expiry: "02 Mar 2027", status: "valid" },
  { label: "PUC Certificate", expiry: "18 Aug 2026", status: "expiring" },
];
