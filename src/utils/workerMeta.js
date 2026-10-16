// Display metadata for worker profile enums (shared by Find Help,
// Worker Profile and My Work screens).

export const SERVICE_OPTIONS = [
  { value: "cleaning", label: "Cleaning" },
  { value: "cooking", label: "Cooking" },
  { value: "childcare", label: "Childcare" },
  { value: "laundry", label: "Laundry" },
  { value: "elderly_care", label: "Elderly care" },
  { value: "housekeeping", label: "Housekeeping" },
];

export const AVAILABILITY_OPTIONS = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "live_in", label: "Live-in" },
  { value: "weekends", label: "Weekends" },
  { value: "flexible", label: "Flexible" },
];

export function serviceLabel(value) {
  return SERVICE_OPTIONS.find((s) => s.value === value)?.label || value;
}

export function availabilityLabel(value) {
  return AVAILABILITY_OPTIONS.find((a) => a.value === value)?.label || value;
}
