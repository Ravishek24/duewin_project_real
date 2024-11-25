import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPassword from './pages/ForgotPassword';
import CustomerService from './pages/CustomerService';
import ProfilePage from './pages/ProfilePage';
import Wallet from './pages/Wallet';
import ActivityPage from './pages/ActivityPage';
import PromotionPage from './pages/PromotionPage';
import Subordinate from './pages/Subordinate';
import Attandancebonus from './pages/AttendanceBonus';
import GameStatistics from './pages/GameStatistics';
import ActivityAward from './pages/ActivityAward';
import CommissionDetailsPage from './pages/CommissionDetailPage';
import PromotionRule from './pages/PromotionRule';
import AgentCustomer from './pages/AgentCustomer';
import RebateRatio from './pages/RebateRatio';
import Rebate from './pages/rebate';
import Jackpot from './pages/Jackpot';
import Gift from './pages/Gift';
import Home from './pages/Home';

function App() {
  return (
    <BrowserRouter>
      
      <main className="flex-grow">
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgotpassword" element={<ForgotPassword />} />
          <Route path="/customerservice" element={<CustomerService />} />
          <Route path="/ProfilePage" element={<ProfilePage />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/activityPage" element={<ActivityPage />} />
          <Route path="/promotionPage" element={<PromotionPage />} />
          <Route path="/subordinate" element={<Subordinate />} />
          <Route path="/gamestatistics" element={<GameStatistics />} />
          <Route path="/activityaward" element={<ActivityAward />} />
          <Route path="/commissiondetailpage" element={<CommissionDetailsPage />} />
          <Route path="/promotionrule" element={<PromotionRule/>} />
          <Route path="/rebate" element={<Rebate/>} />
          <Route path="/jackpot" element={<Jackpot/>} />
          <Route path="/Gift" element={<Gift/>} />
          <Route path="/Attendancebonus" element={<Attandancebonus/>} />
          <Route path="/home" element={<Home/>} />
          <Route path="/agentcustomer" element={<AgentCustomer/>} />
          <Route path="/rebateratio" element={<RebateRatio/>} />
          {/* Redirect to /login if no routes match */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
