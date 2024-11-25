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
  FaRegFileAlt,
  FaChevronDown,
} from "react-icons/fa";

function Subordinate() {
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
    <div className="bg-white min-h-screen flex flex-col items-center justify-center">
      <div className="text-center mb-0 w-full max-w-md px-8 mt-4">
        <h1 className="text-2xl font-sans text-black mb-1">
          Subordinate data
        </h1>
      </div>

      <div className="bg-gray-100 p-4 shadow-md w-full max-w-md h-full mt-4 flex flex-col justify-center">
        <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-0">
          <div className="flex items-center space-x-2 ml-auto w-full">
            {" "}
            {/* Make container full width */}
            <input
              type="text"
              placeholder="Search"
              className="border border-gray-300 rounded w-full p-2 text-sm"
            />
            <button className="bg-blue-500 text-white p-2 rounded">
              Search
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex justify-between items-center">
            <select className="rounded p-2 text-sm bg-white w-full p-4 rounded-lg shadow-md mb-2 mt-2">
              <option value="all">All</option>
              <option value="tier1">Tier 1</option>
              <option value="tier2">Tier 2</option>
            </select>
          </div>

          <div className="flex justify-between items-center">
            <input
              type="date"
              className="rounded-lg p-4 text-sm shadow-md mb-2 mt-2 w-full border-gray-300"
            />
          </div>
        </div>

        <div className="bg-custom-blue p-8 rounded-lg shadow-md mt-2 mb-56">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-white">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-white">
                <span className="font-semibold"></span> Deposit number
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-l-2 pl-4 items-center">
              <div className="text-white">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-white">
                <span className="font-semibold"></span> Deposit amount
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-white">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-white">
                <span className="font-semibold"></span> Number of bettors
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-l-2 pl-4 items-center">
              <div className="text-white">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-white">
                <span className="font-semibold"></span> Total bet
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-white">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-white">
                <span className="font-semibold"></span> Number of people making first deposit
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-l-2 pl-4 items-center">
              <div className="text-white">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-white">
                <span className="font-semibold"></span> First deposit amount
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Subordinate;
