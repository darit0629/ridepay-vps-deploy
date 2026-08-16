// Client-side duplicate of api/school-router.ts's MORNING_STAGES/EVENING_STAGES
// — client files must never import runtime values from api/*.ts (only
// `import type`), since that pulls the server's trpc/zod/middleware chain
// into the client bundle and blanks every page. See FareConfigContext.tsx's
// fallbackFareConfig for the same established pattern.
export const MORNING_STAGES = [
  "driver_assigned", "driver_started", "near_pickup", "arrived_pickup",
  "student_boarded", "pickup_confirmed", "left_pickup", "reached_school",
  "student_dropped", "trip_completed",
] as const;
export const EVENING_STAGES = [
  "driver_assigned", "driver_started", "reached_school", "student_boarded",
  "left_school", "near_home", "reached_home", "student_dropped", "trip_completed",
] as const;

export const STAGE_LABELS: Record<string, string> = {
  driver_assigned: "Driver Assigned",
  driver_started: "Driver Started",
  near_pickup: "Driver Near Pickup",
  arrived_pickup: "Driver Arrived",
  student_boarded: "Student Boarded",
  pickup_confirmed: "Pickup Confirmed",
  left_pickup: "Vehicle Left Pickup",
  reached_school: "Reached School",
  left_school: "Left School",
  near_home: "Near Home",
  reached_home: "Reached Home",
  student_dropped: "Student Dropped",
  trip_completed: "Trip Completed",
};
