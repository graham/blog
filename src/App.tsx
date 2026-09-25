import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import ConvexClientProvider from "./components/ConvexClientProvider";
import { FeaturesProvider } from "./components/FeaturesProvider";
import Calendar from "./pages/Calendar";
import Photos from "./pages/Photos";
import { AdminRoute } from "./components/AdminRoute";
import { SiteGate } from "./components/SiteGate";
import Home from "./pages/Home";
import Post from "./pages/Post";
import Tag from "./pages/Tag";
import SignIn from "./pages/SignIn";
import SignOut from "./pages/SignOut";
import WhoAmI from "./pages/WhoAmI";
import Limbo from "./pages/Limbo";
import Invite from "./pages/Invite";
import AdminPosts from "./pages/admin/Posts";
import AdminDrafts from "./pages/admin/Drafts";
import Editor from "./pages/admin/Editor";
import AdminChannels from "./pages/admin/Channels";
import ChannelDetail from "./pages/admin/ChannelDetail";
import ApiKeys from "./pages/admin/ApiKeys";
import AgentStatus from "./pages/admin/AgentStatus";
import AdminUsers from "./pages/admin/Users";
import AdminSettings from "./pages/admin/Settings";
import AdminBookmarkGroups from "./pages/admin/BookmarkGroups";
import BookmarkGroupDetail from "./pages/admin/BookmarkGroupDetail";
import AdminTags from "./pages/admin/Tags";
import TagDetail from "./pages/admin/TagDetail";
import AdminViews from "./pages/admin/Views";
import ScheduleDrafts from "./pages/admin/ScheduleDrafts";

export default function App() {
  return (
    <ConvexClientProvider>
      <FeaturesProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <SiteGate>
                <Home />
              </SiteGate>
            }
          />
          <Route
            path="/posts/:slug"
            element={
              <SiteGate>
                <Post />
              </SiteGate>
            }
          />
          <Route
            path="/tags/:tag"
            element={
              <SiteGate>
                <Tag />
              </SiteGate>
            }
          />
          <Route
            path="/calendar"
            element={
              <SiteGate>
                <Calendar />
              </SiteGate>
            }
          />
          <Route
            path="/photos"
            element={
              <SiteGate>
                <Photos />
              </SiteGate>
            }
          />
          <Route path="/timings" element={<Navigate to="/calendar" replace />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/invite/:token" element={<Invite />} />
          <Route path="/signout" element={<SignOut />} />
          <Route path="/whoami" element={<WhoAmI />} />
          <Route path="/limbo" element={<Limbo />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPosts />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/drafts"
            element={
              <AdminRoute>
                <AdminDrafts />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/schedule_drafts"
            element={
              <AdminRoute>
                <ScheduleDrafts />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/preview/:slug"
            element={
              <AdminRoute>
                <Post preview />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/posts/:id"
            element={
              <AdminRoute>
                <Editor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/channels"
            element={
              <AdminRoute>
                <AdminChannels />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminUsers />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminRoute>
                <AdminSettings />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/api-keys"
            element={
              <AdminRoute>
                <ApiKeys />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/api-keys/agents"
            element={
              <AdminRoute>
                <AgentStatus />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/channels/:id"
            element={
              <AdminRoute>
                <ChannelDetail />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/bookmarks"
            element={
              <AdminRoute>
                <AdminBookmarkGroups />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/bookmarks/:id"
            element={
              <AdminRoute>
                <BookmarkGroupDetail />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/tags"
            element={
              <AdminRoute>
                <AdminTags />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/views"
            element={
              <AdminRoute>
                <AdminViews />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/tags/:id"
            element={
              <AdminRoute>
                <TagDetail />
              </AdminRoute>
            }
          />
        </Routes>
      </BrowserRouter>
      </FeaturesProvider>
    </ConvexClientProvider>
  );
}
