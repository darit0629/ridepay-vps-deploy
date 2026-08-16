// Full Driver Partner Terms & Conditions shown (and required to be accepted)
// in StepTerms.tsx before a driver can submit their registration. Kept as
// its own content module since it's long and purely static — StepTerms.tsx
// only needs to know how to render a TermsBlock[], not the legal text
// itself.
export type TermsBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

const p = (text: string): TermsBlock => ({ type: "paragraph", text });
const h = (text: string): TermsBlock => ({ type: "heading", text });
const b = (items: string[]): TermsBlock => ({ type: "bullets", items });

export const DRIVER_TERMS_EFFECTIVE_DATE = "August 15, 2026";

export const DRIVER_TERMS_CONTENT: TermsBlock[] = [
  p(`Effective Date: ${DRIVER_TERMS_EFFECTIVE_DATE}`),
  p("By registering as a Driver Partner with RidePay, you agree to the following Terms & Conditions and Driver Policies."),

  h("1. Driver Eligibility"),
  p("The Driver must:"),
  b([
    "Provide genuine and accurate personal information.",
    "Hold a valid driving licence for the vehicle category operated.",
    "Have a legally registered vehicle.",
    "Maintain valid vehicle documents, insurance, permits and certificates as applicable.",
    "Complete RidePay's verification/KYC process.",
    "Comply with all applicable traffic, transport and motor-vehicle laws.",
    "Immediately inform RidePay if any submitted document becomes invalid, suspended or expired.",
  ]),
  p("RidePay may reject or suspend an application if the Driver or vehicle fails verification or applicable legal/safety requirements."),

  h("2. Vehicle Policy"),
  p("The Driver must operate only the vehicle approved and registered with RidePay. The vehicle must:"),
  b([
    "Be roadworthy and properly maintained.",
    "Have valid applicable insurance.",
    "Have valid registration and permits.",
    "Meet applicable safety requirements.",
    "Be reasonably clean and suitable for passengers.",
    "Not be materially different from the vehicle registered on RidePay.",
  ]),
  p("For Toto/E-Rickshaw Drivers, RidePay may provide passenger rides, parcel delivery, school rides, women-focused rides, scheduled rides, round trips, hourly rentals, full-day rentals and other services depending on eligibility and availability."),

  h("3. RidePay Driver App"),
  p("The Driver agrees to use the RidePay Driver App for:"),
  b([
    "Receiving ride requests.",
    "Accepting/rejecting eligible requests.",
    "Navigation.",
    "Starting and ending trips.",
    "Parcel collection/delivery.",
    "School schedules.",
    "Viewing earnings.",
    "Wallet management.",
    "Payout requests.",
    "Receiving important notifications.",
  ]),
  p("The Driver must not manipulate the application, GPS, ride status, location, fare or trip information."),

  h("4. Account Security"),
  p("The Driver's account is personal and must not be shared. The Driver must not allow another person to operate using their RidePay account. Sharing or selling an account may result in immediate suspension or termination."),

  h("5. Ride Acceptance & Completion"),
  p("After accepting a ride, the Driver should make reasonable efforts to reach the passenger and complete the trip. The Driver must:"),
  b([
    "Follow safe and lawful routes.",
    "Treat passengers respectfully.",
    "Not demand unauthorized charges.",
    "Not intentionally manipulate the destination or fare.",
    "Complete the trip through the RidePay App.",
    "Report genuine problems through the appropriate RidePay support channel.",
  ]),

  h("6. Driver Commission"),
  p("RidePay's standard commission structure is:"),
  { type: "table", headers: ["Ride Fare", "RidePay Commission"], rows: [
    ["₹0–₹100", "₹2 per ride"],
    ["Above ₹100–₹200", "2%"],
    ["Above ₹200–₹300", "3%"],
    ["₹300 and above", "4%"],
  ] },
  p("Example: ₹150 ride → 2% commission = ₹3. ₹250 ride → 3% commission = ₹7.50. ₹400 ride → 4% commission = ₹16."),
  p("This means the Driver retains 96–100% of the fare across every tier above — well within the minimum driver share required for a driver onboarded with their own vehicle under the 2025 Motor Vehicle Aggregator Guidelines issued by the Ministry of Road Transport and Highways."),
  p("The final commission structure will always be subject to applicable law and any service-specific pricing disclosed in the Driver App."),

  h("7. Driver Earnings"),
  p("Eligible earnings may include:"),
  b([
    "Passenger ride earnings.",
    "Parcel earnings.",
    "School ride earnings.",
    "Rental earnings.",
    "Scheduled ride earnings.",
    "Eligible cancellation compensation.",
    "Incentives.",
    "Bonuses.",
    "Referral rewards.",
    "Other promotional earnings.",
  ]),
  p("Earnings may initially appear as Pending until payment and trip reconciliation are completed."),

  h("8. Driver Wallet"),
  p("The Driver Wallet may display available balance, pending balance, ride/parcel/school earnings, cancellation compensation, bonuses, incentives, payouts, adjustments and transaction history. The RidePay Wallet is an internal earnings/transaction ledger and is not necessarily a bank account or deposit account."),

  h("9. Payout & Withdrawal Policy"),
  p("Eligible available wallet funds may be withdrawn according to RidePay's payout system. Standard withdrawal processing time: 3–7 working days."),
  p("The 3–7 working-day period may be affected by:"),
  b([
    "Bank holidays.",
    "Banking delays.",
    "Payment-provider delays.",
    "KYC verification.",
    "Incorrect bank information.",
    "Compliance checks.",
    "Fraud/risk reviews.",
    "Technical issues.",
    "Payment reconciliation.",
  ]),
  p("RidePay does not guarantee that funds will arrive on a specific calendar date."),

  h("10. Automatic Payout"),
  p("RidePay may provide an Automatic Payout option. When enabled and the Driver is eligible, available earnings may automatically be transferred according to the configured payout cycle. Automatic payout may be switched ON or OFF by RidePay/Admin, subject to the Driver's eligibility and applicable payment-provider requirements."),

  h("11. Bank & UPI Information"),
  p("The Driver is responsible for providing correct payout information. Incorrect account number, IFSC, account holder details, UPI/VPA or bank information may cause payout delays or failure. RidePay may require verification before processing a payout."),

  h("12. Payout Holds"),
  p("RidePay may temporarily hold earnings where reasonably necessary because of payment disputes, chargebacks, fraud investigations, duplicate payments, incorrect fare calculation, suspicious activity, KYC issues, account verification, or technical reconciliation. Once the issue is resolved, eligible funds may be released subject to applicable rules."),

  h("13. Cancellation Policy"),
  p("Drivers should cancel only for genuine reasons, such as: passenger unavailable, unsafe pickup, vehicle emergency, accident, road closure, emergency situation, technical problem, or other valid reasons recognized by RidePay."),
  p("Repeated or unjustified cancellations may affect Driver access, ratings or incentives, subject to applicable law and RidePay's cancellation policy. For passenger cancellations, any cancellation fee actually collected may be distributed between RidePay and the Driver according to the applicable cancellation policy."),
  p("The 2025 central Motor Vehicle Aggregator Guidelines also contain specific cancellation provisions, including limits on certain driver/passenger cancellation charges, which RidePay's cancellation policy is designed to operate within."),

  h("14. Cancellation Earnings"),
  p("If a passenger cancellation fee is successfully collected and the Driver is eligible: Passenger cancellation fee → applicable RidePay commission/adjustment → eligible Driver compensation → Driver Wallet. If the payment is later reversed or refunded, the corresponding wallet adjustment may be made."),

  h("15. Parcel Policy"),
  p("Drivers may receive eligible parcel requests. The Driver must collect the correct parcel, follow the pickup procedure, keep the parcel reasonably secure, deliver it to the correct destination, and complete delivery confirmation where required. Drivers must not knowingly transport illegal, dangerous, explosive, prohibited or otherwise unlawful items."),

  h("16. School Ride Policy"),
  p("Eligible Drivers may provide School Rides. School Drivers must:"),
  b([
    "Follow the assigned schedule.",
    "Arrive at the designated pickup location.",
    "Follow applicable pickup/drop procedures.",
    "Maintain professional conduct.",
    "Follow the designated/approved route where applicable.",
    "Follow child-safety requirements.",
    "Immediately report emergencies or safety concerns.",
  ]),
  p("RidePay may require additional verification for School Drivers."),

  h("17. Women Ride Policy"),
  p("For eligible Women-focused services, Drivers must maintain professional and respectful conduct. The Driver must not harass the passenger, make inappropriate comments, intimidate or threaten the passenger, misuse passenger information, or engage in inappropriate physical or verbal behaviour. RidePay may impose additional eligibility requirements for such services."),

  h("18. Safety Policy"),
  p("Drivers must never operate while intoxicated, under the influence of alcohol or prohibited drugs, medically unfit to drive, or excessively fatigued where driving would be unsafe. Drivers must follow traffic laws and prioritize passenger, driver and public safety."),

  h("19. Emergency & SOS"),
  p("RidePay may provide emergency/SOS functionality. During an emergency, the Driver should prioritize immediate safety and contact appropriate emergency services when necessary. The Driver must report serious accidents, emergencies or safety incidents to RidePay as soon as reasonably possible."),

  h("20. Road Closure & Route Restrictions"),
  p("RidePay may operate a Route Restriction/Road Closure System. If RidePay identifies a blocked road: navigation may automatically avoid the road, an alternative route may be generated, the Driver may receive a route-change notification, the passenger may receive an updated ETA, and Admin may be notified of affected rides. The Driver must follow lawful road restrictions and police/traffic instructions."),

  h("21. Passenger Conduct"),
  p("Drivers must treat passengers fairly and respectfully. Drivers must not harass passengers, discriminate unlawfully, threaten passengers, use abusive behaviour, demand unauthorized money, force passengers to cancel, manipulate the fare, or misuse passenger information."),

  h("22. Off-Platform Trips"),
  p("Drivers must not use RidePay passenger information to improperly move passengers to unauthorized off-platform bookings or bypass RidePay's safety, tracking or payment systems where prohibited by RidePay policy."),

  h("23. Cash Payments"),
  p("Where cash payment is enabled, the Driver may collect only the applicable amount displayed/authorized by RidePay. The Driver must not demand unauthorized additional charges."),

  h("24. Digital Payments"),
  p("If the RidePay App shows that a passenger has already paid digitally, the Driver must not demand duplicate payment. Any payment issue should be reported through RidePay support."),

  h("25. Driver Rating"),
  p("Passengers may rate Drivers after trips. Ratings may be used for quality monitoring, safety monitoring, incentives, driver eligibility and service access. RidePay may investigate unusual rating patterns or serious complaints."),

  h("26. Incentives & Bonuses"),
  p("RidePay may offer daily bonuses, weekly bonuses, peak-hour incentives, festival bonuses, school-route incentives, parcel incentives, referral rewards and other service-specific incentives. Each promotional campaign may have separate eligibility requirements. RidePay does not guarantee that any particular incentive will always be available."),

  h("27. Referral Policy"),
  p("Driver referral rewards may require a valid referral code, a new Driver registration, successful KYC, vehicle approval, a minimum number of completed rides, and other qualifying conditions. Self-referrals, fake accounts and referral manipulation are prohibited."),

  h("28. Document Expiry"),
  p("The Driver must keep all required documents valid. RidePay may restrict Driver access if a driving licence, insurance, permit or vehicle documentation expires or becomes invalid, or if required certificates expire. Access may be restored after successful verification of updated documents."),

  h("29. Fraud & Misuse"),
  p("The following may result in investigation, suspension or termination:"),
  b([
    "Fake rides.", "Fake cancellations.", "Fake no-shows.", "GPS spoofing.",
    "Location manipulation.", "Fare manipulation.", "Multiple-account abuse.",
    "Referral fraud.", "Wallet manipulation.", "Payment fraud.",
    "Account sharing.", "False documents.", "Collusion with passengers or other Drivers.",
  ]),

  h("30. Account Suspension"),
  p("RidePay may temporarily suspend an account for safety concerns, invalid documents, fraud investigations, serious complaints, account sharing, GPS manipulation, repeated policy violations, payment issues, or legal/regulatory concerns. Where appropriate, the Driver may be given an opportunity to provide an explanation or appeal."),

  h("31. Account Termination"),
  p("RidePay may terminate the Driver account for serious or repeated violations, fraud, safety issues, false documentation, unlawful activity, or other material breaches of these Terms. Eligible undisputed earnings will be processed according to RidePay's payout procedures, subject to lawful adjustments, pending disputes, investigations or reversals."),

  h("32. Privacy & Driver Data"),
  p("RidePay may process Driver information required for registration, KYC, vehicle verification, trip operations, navigation, safety, payments, payouts, customer support, fraud prevention and legal compliance. Driver information will be handled according to RidePay's Privacy Policy and applicable law."),

  h("33. Passenger Privacy"),
  p("Drivers must not misuse or disclose passenger information obtained through RidePay. Passenger information may only be used for legitimate RidePay service purposes."),

  h("34. No Guaranteed Income"),
  p("RidePay does not guarantee a minimum number of rides, a minimum income, a minimum number of parcel requests, continuous passenger demand, or continuous availability of any service. Driver earnings depend on demand, location, availability, fares, service type, cancellations and other factors."),

  h("35. Changes to Policies"),
  p("RidePay may update commission, payout procedures, service availability, incentives, cancellation rules, driver eligibility, safety requirements and operational policies. Material changes will be communicated through the Driver App, website, email or other appropriate channels."),

  h("36. Compliance With Law"),
  p("The Driver must comply with all applicable Indian and State laws, including motor-vehicle, traffic, transport, insurance, permit and safety requirements. RidePay's policies will be interpreted subject to applicable law and regulatory requirements, including the 2025 Motor Vehicle Aggregator Guidelines issued by the Ministry of Road Transport and Highways."),

  h("37. Disputes & Support"),
  p("For earnings, payout, ride or wallet disputes, the Driver should contact RidePay Support at online@saypx.in or +91 62940 11684, and provide the relevant Ride ID, Transaction ID, Payout ID, date, amount and supporting information. RidePay may investigate and reconcile disputed transactions."),

  h("38. Acceptance"),
  p("By checking “I Agree” and submitting the Driver Registration Form, the Driver confirms that they:"),
  b([
    "Have read these Terms & Conditions.",
    "Understand the commission and payout policies.",
    "Understand the 3–7 working-day withdrawal policy.",
    "Agree to follow RidePay's safety and operational policies.",
    "Confirm that submitted information is genuine.",
    "Agree to comply with applicable laws.",
    "Consent to RidePay processing the information required to operate the Driver Partner account.",
    "Accept RidePay's Driver Partner Terms & Conditions and related policies.",
  ]),
  p("RidePay reserves the right to update these Terms and Policies from time to time in accordance with applicable law."),
  p("RidePay — Safe. Smart. Shared."),
];
