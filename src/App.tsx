import { Navigate, Route, Routes } from "react-router-dom";
import { StoreProvider, useStore } from "./state/store";
import { AppShell } from "./ui/AppShell";
import { ForgotPasswordPage, LoginPage, MfaPage } from "./pages/Auth";
import { DashboardPage } from "./pages/Dashboard";
import { SearchPage } from "./pages/Search";
import { ObjectDetailPage } from "./pages/ObjectDetail";
import { GraphPage } from "./pages/Graph";
import { GraphEditorPage } from "./pages/GraphEditor";
import {
  BriefPage,
  CaseEvidence,
  CaseLayout,
  CaseListPage,
  CaseNotes,
  CaseObjects,
  CaseOverview,
  CaseSignals,
  CaseTimeline,
} from "./pages/Cases";
import { ErReviewPage } from "./pages/ErReview";
import { AgenciesPage, DataSourcesLayout, PipelinePage, SourceDetail, SourcesTable } from "./pages/DataSources";
import { AuditLogPage } from "./pages/Audit";
import { AccessibilitySettings, DataPrivacySettings, NotificationSettings, PersonalHistorySettings, ProfileSettings, SecuritySettings, SettingsLayout, WorkspaceSettings } from "./pages/Settings";

function Guard() {
  const { user } = useStore();
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export default function App() {
  return (
    <StoreProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mfa" element={<MfaPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route element={<Guard />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/objects/:id" element={<ObjectDetailPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/graph/editor" element={<GraphEditorPage />} />
          <Route path="/graph/:id" element={<GraphPage />} />
          <Route path="/graph/:id/timeline" element={<GraphPage />} />
          <Route path="/entity-resolution/review" element={<ErReviewPage />} />
          <Route path="/entity-resolution/review/:match_id" element={<ErReviewPage />} />
          <Route path="/cases" element={<CaseListPage />} />
          <Route path="/cases/:id" element={<CaseLayout />}>
            <Route index element={<CaseOverview />} />
            <Route path="objects" element={<CaseObjects />} />
            <Route path="evidence" element={<CaseEvidence />} />
            <Route path="signals" element={<CaseSignals />} />
            <Route path="notes" element={<CaseNotes />} />
            <Route path="timeline" element={<CaseTimeline />} />
            <Route path="brief" element={<BriefPage />} />
          </Route>
          <Route path="/data-sources" element={<DataSourcesLayout />}>
            <Route index element={<SourcesTable />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="agencies" element={<AgenciesPage />} />
            <Route path=":id" element={<SourceDetail />} />
          </Route>
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="security" element={<SecuritySettings />} />
            <Route path="notifications" element={<NotificationSettings />} />
            <Route path="workspace" element={<WorkspaceSettings />} />
            <Route path="accessibility" element={<AccessibilitySettings />} />
            <Route path="data-privacy" element={<DataPrivacySettings />} />
            <Route path="history" element={<PersonalHistorySettings />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </StoreProvider>
  );
}
