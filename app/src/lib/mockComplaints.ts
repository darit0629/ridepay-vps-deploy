export type ComplaintStatus = "Open" | "In Progress" | "Resolved" | "Closed";
export type ReporterType = "Customer" | "Driver";

export interface ComplaintMessage {
  sender: "admin" | "reporter";
  text: string;
  time: string;
}

export interface Complaint {
  id: string;
  subject: string;
  description: string;
  user: string;
  userPhone: string;
  reporterType: ReporterType;
  relatedRideId?: string;
  date: string;
  status: ComplaintStatus;
  messages: ComplaintMessage[];
}

export const complaints: Complaint[] = [
  {
    id: "CMT1234",
    subject: "Driver was late and not responding",
    description: "I booked a ride at 9:00 AM but the driver arrived 25 minutes late and did not answer any of my calls in the meantime. This made me late for an important appointment.",
    user: "Anjali Sharma",
    userPhone: "+91 98765 43210",
    reporterType: "Customer",
    relatedRideId: "#RID12345",
    date: "20 May, 2024",
    status: "Open",
    messages: [],
  },
  {
    id: "CMT1233",
    subject: "Fare charged extra",
    description: "The app quoted ₹70 for my trip but I was charged ₹95 at the end. The driver said there was a toll but I don't believe that route has any tolls.",
    user: "Rahul Verma",
    userPhone: "+91 91234 56789",
    reporterType: "Customer",
    relatedRideId: "#RID12344",
    date: "19 May, 2024",
    status: "In Progress",
    messages: [
      { sender: "admin", text: "Hi Rahul, thanks for reporting this. We're checking the trip logs now.", time: "19 May, 10:20 AM" },
      { sender: "reporter", text: "Okay, please let me know soon.", time: "19 May, 10:25 AM" },
    ],
  },
  {
    id: "CMT1232",
    subject: "Driver behaviour was rude",
    description: "The driver was speaking rudely throughout the trip and refused to take the route I suggested even though it was shorter.",
    user: "Priti Das",
    userPhone: "+91 99011 22334",
    reporterType: "Customer",
    relatedRideId: "#RID12343",
    date: "18 May, 2024",
    status: "Open",
    messages: [],
  },
  {
    id: "CMT1231",
    subject: "Payment failed but deducted",
    description: "My UPI payment showed as failed on screen but the amount was deducted from my bank account. I need this refunded.",
    user: "Subhajit Roy",
    userPhone: "+91 87776 54321",
    reporterType: "Customer",
    relatedRideId: "#RID12342",
    date: "17 May, 2024",
    status: "Resolved",
    messages: [
      { sender: "admin", text: "We've verified the duplicate deduction and processed a refund of ₹25 to your original payment method.", time: "17 May, 4:10 PM" },
      { sender: "reporter", text: "Received it, thank you!", time: "17 May, 5:00 PM" },
    ],
  },
  {
    id: "CMT1230",
    subject: "App crashed during booking",
    description: "The app crashed twice while I was trying to book a ride during peak hours. Had to restart my phone.",
    user: "Anjali Sharma",
    userPhone: "+91 98765 43210",
    reporterType: "Customer",
    date: "16 May, 2024",
    status: "Closed",
    messages: [
      { sender: "admin", text: "Thanks for the report — this has been fixed in the latest app update.", time: "16 May, 6:00 PM" },
    ],
  },
];

export const complaintStatusConfig: Record<ComplaintStatus, { label: string; color: string; bg: string }> = {
  Open: { label: "Open", color: "#DC2626", bg: "#FEE2E2" },
  "In Progress": { label: "In Progress", color: "#FF6B00", bg: "#FFF5EB" },
  Resolved: { label: "Resolved", color: "#138808", bg: "#E8F5E8" },
  Closed: { label: "Closed", color: "#6B7280", bg: "#F3F4F6" },
};

export const complaintStatusFlow: ComplaintStatus[] = ["Open", "In Progress", "Resolved", "Closed"];
