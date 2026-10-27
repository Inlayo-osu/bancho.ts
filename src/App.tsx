import { Route, Routes } from "react-router-dom";

import { Layout } from "@/components/layout/Layout";
import { AdminPage } from "@/pages/AdminPage";
import { BeatmapPage } from "@/pages/BeatmapPage";
import { ChatPage } from "@/pages/ChatPage";
import { ClanPage } from "@/pages/ClanPage";
import { ClansPage } from "@/pages/ClansPage";
import { FriendsPage } from "@/pages/FriendsPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { HomePage } from "@/pages/HomePage";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { TopPlaysPage } from "@/pages/TopPlaysPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PlayerPage } from "@/pages/PlayerPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ScorePage } from "@/pages/ScorePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { UsersPage } from "@/pages/UsersPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/topplays" element={<TopPlaysPage />} />
        <Route path="/clans" element={<ClansPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/clan/:clanId" element={<ClanPage />} />
        <Route path="/u/:playerId" element={<PlayerPage />} />
        <Route path="/b/:mapId" element={<BeatmapPage />} />
        <Route path="/s/:scoreId" element={<ScorePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
