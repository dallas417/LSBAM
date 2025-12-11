import { lazy } from "react"; 

const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'));
const NotFound = lazy(() => import("../pages/404/NotFound"));

export const routes = [
  { path: '/', element: <Dashboard />, title: "Dashboard" },
  { path: '*', element: <NotFound />, title: "404 Not Found" }
];