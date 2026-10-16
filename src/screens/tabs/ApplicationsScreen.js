import React from "react";

import ComingSoonScreen from "../../components/ui/ComingSoonScreen";

// Applications tab (maid) — lands with the applications milestone.
export default function ApplicationsScreen() {
  return (
    <ComingSoonScreen
      icon="file-text"
      title="Applications are coming soon"
      blurb="Every job you apply for will live here with its status — submitted, viewed, interview invited, hired or declined — so nothing slips through."
    />
  );
}
