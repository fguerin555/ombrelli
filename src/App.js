import React from "react";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./Global.css";
import { AuthProvider } from "./contexts/AuthContext";

import BeachPlan from "./pages/BeachPlanFile/BeachPlan";
import ReservationList from "./pages/ReservationListFile/ReservationList";
import Query from "./pages/QueryFile/Query";
import QRCodeReader from "./pages/QRCodeReaderFile/QRCodeReader";
import QRCodeHandlerPage from "./pages/QRCodeHandlerPageFile/QRCodeHandlerPage";
import BeachPlanPeriod from "./pages/BeachPlanPeriodFile/BeachPlanPeriod";
import ChangeExchange from "./pages/ChangeExchangeFile/ChangeExchange";
import TestQueryName from "./pages/TestQueryNameFile/TestQueryName";
import TestQueryPlan from "./pages/TestQueryPlanFile/TestQueryPlan";
import InternalScannerPage from "./pages/InternalScannerPage/InternalScannerPage";
import FeedbackPage from "./pages/FeedbackPageFile/FeedbackPage";
import LoginPage from "./pages/LoginPageFile/LoginPage";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Listing from "./pages/ListingFile/Listing";

const App = () => {
  return (
    <AuthProvider>
      <Router basename="/ombrelli">
        {" "}
        <Navbar />
        <div className="app-content">
          {" "}
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/ombrelli" element={<BeachPlan />} />
              <Route path="/" element={<BeachPlan />} />
              <Route path="/beachplan" element={<BeachPlan />} />
              <Route path="/reservationList" element={<ReservationList />} />
              <Route path="/changeexchange" element={<ChangeExchange />} />
              <Route path="/qrcodereader" element={<QRCodeReader />} />
              <Route path="/beachplanperiod" element={<BeachPlanPeriod />} />
              <Route path="/query" element={<Query />} />
              <Route path="/testqueryplan" element={<TestQueryPlan />} />
              <Route path="/testqueryname" element={<TestQueryName />} />
              <Route path="/scan-interne" element={<InternalScannerPage />} />
              <Route path="/qr-scan-resultat" element={<QRCodeHandlerPage />} />
              <Route path="/feedbackpage" element={<FeedbackPage />} />
              <Route path="/listing" element={<Listing />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
