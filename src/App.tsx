import { AppProvider, useApp } from "./state";
import { CampaignsView } from "./views/CampaignsView";
import { CampaignShell } from "./views/CampaignShell";
import { PlayerApp } from "./player/PlayerApp";

function Router() {
  const { campaignId, role } = useApp();

  // No campaign selected → the campaign picker (shared by both roles).
  if (!campaignId) return <CampaignsView />;

  // Inside a campaign, the interface diverges sharply by role — the core
  // "controlled simplicity" principle from the concept doc.
  return role === "gm" ? <CampaignShell /> : <PlayerApp />;
}

export default function App() {
  return (
    <AppProvider>
      <div className="app-wash" />
      <Router />
    </AppProvider>
  );
}
