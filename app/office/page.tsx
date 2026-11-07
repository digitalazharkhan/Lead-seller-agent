import { OfficeClient } from "./office-client";

export const metadata = {
  title: "AI Khan Virtual Office",
  description: "Local operations floor for approved AI Khan lead tasks.",
};

export default function OfficePage() {
  return <OfficeClient />;
}
