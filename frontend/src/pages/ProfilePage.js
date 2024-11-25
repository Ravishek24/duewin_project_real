import React, { useState } from "react";
import {
  FaPhone,
  FaEnvelope,
  FaLock,
  FaQuestionCircle,
  FaKey,
  FaHome,
  FaUser,
  FaBell,
  FaCog,
} from "react-icons/fa";
import Header from "../components/Header";
import Footer from "../components/Footer";

function ProfilePage() {
  const [isPhoneLogin, setIsPhoneLogin] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setverificationCode] = useState("");
  const [privacyAgreement, setPrivacyAgreement] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);

  const handlePhoneNumberChange = (event) => setPhoneNumber(event.target.value);
  const handleEmailChange = (event) => setEmail(event.target.value);
  const handlePasswordChange = (event) => setPassword(event.target.value);
  const handleConfirmPasswordChange = (event) =>
    setConfirmPassword(event.target.value);
  const handleverificationCodeChange = (event) =>
    setverificationCode(event.target.value);
  const handlePrivacyAgreementChange = (event) =>
    setPrivacyAgreement(event.target.checked);
  const handleRememberPasswordChange = (event) =>
    setRememberPassword(event.target.checked);

  const handleSendVerificationCode = () => {
    // Logic to send verification code
    console.log("Verification code sent!");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    const loginData = isPhoneLogin
      ? { phoneNumber, password }
      : { email, password };
    console.log("Login data:", loginData);
    console.log("Remember password:", rememberPassword);
    console.log("verification code:", verificationCode);
    console.log("Privacy agreement accepted:", privacyAgreement);
  };

  return (
    <div className="bg-custom-blue min-h-screen flex flex-col items-center justify-center">
      <Header/>
      <div className="text-left mb-0 w-full max-w-md px-8 mt-10">
        <div className="flex items-center mt-4">
          {/* Profile Picture and Info */}
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-custom-pink mr-4">
            <img
              src="https://via.placeholder.com/150"
              alt="User Profile"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-custom-pink">
              User Name
            </h2>
            <p className="text-custom-pink text-sm">UID: 12345</p>
            <p className="text-gray-500 text-xs">
              Last Login: November 5, 2024, 10:30 AM
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 p-8 shadow-md w-full max-w-md h-full mt-20 flex flex-col justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="text-gray-600 mt-2">
                Total Balance
                <br />
                0.00
              </div>
            </div>
            <div></div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-8">
            <div className="flex flex-col items-center">
              <div className="bg-orange-100 rounded-full p-4 shadow-md">
                <svg
                  className="w-6 h-6 text-orange-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-12 0v 1a6 6 0 0112 0v1z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-blue-100 rounded-full p-4 shadow-md">
                <svg
                  className="w-6 h-6 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-red-100 rounded-full p-4 shadow-md">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v8m4-4H8"
                  />
                </svg>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-yellow-100 rounded-full p-4 shadow-md">
                <svg
                  className="w-6 h-6 text-yellow-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.77 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md mt-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="text-gray-600 mt-2">
                Safe
                <br />
                the daily interest rate is 0.1%, and the income is calculated
                once every 1 minutes.
              </div>
            </div>
            <div></div>
          </div>
        </div>

        {/* 2x2 grid layout */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-black">game History</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-black">Transaction</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-black">Deposit</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <p className="text-black">Withdraw</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md mt-8">
          <div className="space-y-4">
            {" "}
            {/* Container for vertical spacing */}
            <div>
              <button
                type="button"
                className="block mb-2 text-base font-medium text-gray-900 flex items-center gap-1"
              >
                <FaPhone className="text-custom-blue" />
                Phone Number
                <span className="ml-auto text-gray-500">{">"}</span>{" "}
              </button>
              <hr className="my-4 border-gray-300" />
            </div>
            <div>
              <button
                type="button"
                className="block mb-2 text-base font-medium text-gray-900 flex items-center gap-1"
              >
                <FaLock className="text-custom-blue" />
                Set Password
                <span className="ml-auto text-gray-500">{">"}</span>{" "}
              </button>
              <hr className="my-4 border-gray-300" />
            </div>
            <div>
              <button
                type="button"
                className="block text-base font-medium text-gray-900 flex items-center gap-1"
              >
                <FaLock className="text-custom-blue" />
                Confirm Password
                <span className="ml-auto text-gray-500">{">"}</span>{" "}
              </button>
              <hr className="my-4 border-gray-300" />
            </div>
            <div>
              <button
                type="button"
                className="block mb-2 text-base font-medium text-gray-900 flex items-center gap-1"
              >
                <FaLock className="text-custom-blue" />
                Set Password
                <span className="ml-auto text-gray-500">{">"}</span>{" "}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md mt-8 grid grid-cols-3 gap-4">
  <div className="symbol flex flex-col items-center">
    <span className="text-3xl">🔑</span>
    <p className="mt-2 text-sm">Key</p>
  </div>
  <div className="symbol flex flex-col items-center">
    <span className="text-3xl">💼</span>
    <p className="mt-2 text-sm">Briefcase</p>
  </div>
  <div className="symbol flex flex-col items-center">
    <span className="text-3xl">📈</span>
    <p className="mt-2 text-sm">Chart</p>
  </div>
  <div className="symbol flex flex-col items-center">
    <span className="text-3xl">📅</span>
    <p className="mt-2 text-sm">Calendar</p>
  </div>
  <div className="symbol flex flex-col items-center">
    <span className="text-3xl">⚙️</span>
    <p className="mt-2 text-sm">Settings</p>
  </div>
  <div className="symbol flex flex-col items-center">
    <span className="text-3xl">🔔</span>
    <p className="mt-2 text-sm">Notification</p>
  </div>
</div>


        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6 mt-8">
          <button
            type="submit"
            className="w-full bg-custom-pink text-white py-3 rounded-full hover:bg-custom-blue focus:ring-2 focus:ring-gray-300"
          >
            Log Out
          </button>
        </form>
      </div>
      <Footer/>
    </div>
  );
}

export default ProfilePage;
