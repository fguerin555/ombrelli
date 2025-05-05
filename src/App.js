import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./Global.css";
import BeachPlan from "./pages/BeachPlanFile/BeachPlan";
import ReservationList from "./pages/ReservationListFile/ReservationList";
import Query from "./pages/QueryFile/Query";
import QRCodeReader from "./pages/QRCodeReaderFile/QRCodeReader";
import BeachPlanPeriod from "./pages/BeachPlanPeriodFile/BeachPlanPeriod";
import ChangeExchange from "./pages/ChangeExchangeFile/ChangeExchange";
import TestQueryName from "./TestQueryName";
import TestQueryPlan from "./TestQueryPlan";
import Navbar from "./components/Navbar";

const App = () => {
  return (
    <Router>
      <div>
        <Navbar />
        <Routes>
          <Route path="/ombrelli" element={<BeachPlan />} />
          <Route path="/" element={<BeachPlan />} />
          <Route path="/beachplan" element={<BeachPlan />} />
          <Route path="/ReservationList" element={<ReservationList />} />
          <Route path="/changeexchange" element={<ChangeExchange />} />
          <Route path="/qrcodereader" element={<QRCodeReader />} />
          <Route path="/beachplanperiod" element={<BeachPlanPeriod />} />
          <Route path="/query" element={<Query />} />
          <Route path="/testqueryplan" element={<TestQueryPlan />} />
          <Route path="/testqueryname" element={<TestQueryName />} />
        </Routes>
      </div>
    </Router>
  );
};
export default App;
