import React from "react";

import ComingSoonScreen from "../../components/ui/ComingSoonScreen";

// Find Jobs tab (maid) — lands with the jobs milestone (PRD §6).
export default function FindJobsScreen() {
  return (
    <ComingSoonScreen
      icon="search"
      title="Find Jobs is on the way"
      blurb="Browse domestic jobs near you, filter by service and pay, and save the ones you like. Employers will see you first if your work profile is complete and your location is set."
    />
  );
}
