import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { UserGuard } from "@/components/account/UserGuard";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import ProductDetail from "@/pages/ProductDetail";
import CategoryFeed from "@/pages/CategoryFeed";
import AdminLogin from "@/pages/admin/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminProducts from "@/pages/admin/Products";
import AdminCategories from "@/pages/admin/Categories";
import AdminInventory from "@/pages/admin/Inventory";
import AdminBanners from "@/pages/admin/Banners";
import AdminFeedSections from "@/pages/admin/FeedSections";
import AdminOrders from "@/pages/admin/Orders";
import SignIn from "@/pages/SignIn";
import AuthCallback from "@/pages/AuthCallback";
import Checkout from "@/pages/Checkout";
import AccountOverview from "@/pages/account/Overview";
import AccountProfile from "@/pages/account/Profile";
import AccountOrders from "@/pages/account/Orders";
import AccountWishlist from "@/pages/account/Wishlist";
import AccountAddresses from "@/pages/account/Addresses";
import AccountPayments from "@/pages/account/Payments";
import AccountReturns from "@/pages/account/Returns";
import AccountNotifications from "@/pages/account/Notifications";

function ProtectedUser({ component: Component }: { component: () => JSX.Element }) {
  return (
    <UserGuard>
      <Component />
    </UserGuard>
  );
}

function StorefrontRouter() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/shop" component={Shop} />
          <Route path="/category/:slug" component={CategoryFeed} />
          <Route path="/product/:slug" component={ProductDetail} />
          <Route path="/signin" component={SignIn} />
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/checkout">
            {() => <ProtectedUser component={Checkout} />}
          </Route>
          <Route path="/account">
            {() => <ProtectedUser component={AccountOverview} />}
          </Route>
          <Route path="/account/profile">
            {() => <ProtectedUser component={AccountProfile} />}
          </Route>
          <Route path="/account/orders">
            {() => <ProtectedUser component={AccountOrders} />}
          </Route>
          <Route path="/account/wishlist">
            {() => <ProtectedUser component={AccountWishlist} />}
          </Route>
          <Route path="/account/addresses">
            {() => <ProtectedUser component={AccountAddresses} />}
          </Route>
          <Route path="/account/payments">
            {() => <ProtectedUser component={AccountPayments} />}
          </Route>
          <Route path="/account/returns">
            {() => <ProtectedUser component={AccountReturns} />}
          </Route>
          <Route path="/account/notifications">
            {() => <ProtectedUser component={AccountNotifications} />}
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function ProtectedAdmin({ component: Component }: { component: () => JSX.Element }) {
  return (
    <AdminGuard>
      <Component />
    </AdminGuard>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin">
        {() => <ProtectedAdmin component={AdminDashboard} />}
      </Route>
      <Route path="/admin/products">
        {() => <ProtectedAdmin component={AdminProducts} />}
      </Route>
      <Route path="/admin/categories">
        {() => <ProtectedAdmin component={AdminCategories} />}
      </Route>
      <Route path="/admin/inventory">
        {() => <ProtectedAdmin component={AdminInventory} />}
      </Route>
      <Route path="/admin/banners">
        {() => <ProtectedAdmin component={AdminBanners} />}
      </Route>
      <Route path="/admin/feed-sections">
        {() => <ProtectedAdmin component={AdminFeedSections} />}
      </Route>
      <Route path="/admin/orders">
        {() => <ProtectedAdmin component={AdminOrders} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  return isAdmin ? <AdminRouter /> : <StorefrontRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
