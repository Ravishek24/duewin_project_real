import React, { useState } from "react";
import { IoWallet } from "react-icons/io5";
import RedialBarChart from "./../components/radialBarChart";
import Header from "../components/Header";
import {
  FaPhone,
  FaEnvelope,
  FaLock,
  FaQuestionCircle,
  FaKey,
} from "react-icons/fa";
import Footer from "../components/Footer";

function Wallet() {
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

  const progressValue = 75; // Example percentage value
  
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
      <Header />
      <div className="text-center mb-0 w-full max-w-md px-8 mt-4 flex flex-col items-center">
        <h1 className="text-xl font-bold text-custom-pink mb-6">Wallet</h1>
        <IoWallet size={40} color="white" />

        <h1 className="text-3xl font-bold text-white mt-1 mb-1"> ₹ 0.00</h1>
        <p className="text-custom-pink text-sm sm:text-base">Total Balance</p>

        {/* Container for two columns */}
        <div className="flex justify-between w-full mt-2">
          {/* Column 1 */}
          <div className="flex flex-col items-center w-1/2">
            <h1 className="text-xl font-sans text-white mb-0">0</h1>
            <p className="text-white text-xs sm:text-base ">Total Amount</p>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col items-center w-1/2">
            <h1 className="text-xl font-sans text-white mb-0">0</h1>
            <p className="text-white text-xs sm:text-base">
              total deposit amount
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 p-4 shadow-md w-full max-w-md h-full mt-4 flex flex-col justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
        <div>
      {/* Pass the percentage as a prop */}
      <RedialBarChart percentage={progressValue} />
    </div>
          <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
            Main wallet transfer
          </button>
          <div className="grid grid-cols-4 gap-4 mt-8 text-center">
            <div className="flex flex-col items-center">
              <div >
                <img
                  src="https://diuwin.net/assets/png/rechargeIcon-e515aee4.png" // Replace this with the actual path to your image
                  alt="Description"
                  className="w-calc(100%+.32rem) h-auto object-cover" // Adjust size and styling as needed
                />
              </div>
              <span className="text-gray-600 mt-0">Deposit</span>
            </div>
            <div className="flex flex-col items-center">
              <div >
                <img
                  src="https://diuwin.net/assets/png/widthdrawBlue-80197e64.png" // Replace this with the actual path to your image
                  alt="Description"
                  className="w-calc(100%+.32rem) h-auto object-cover" // Adjust size and styling as needed
                />
              </div>
              <span className="text-gray-600 mt-0">Withdraw</span>
            </div>
            <div className="flex flex-col items-center">
              <div >
                <img
                  src="https://diuwin.net/assets/png/rechargeHistory-b5a853c0.png" // Replace this with the actual path to your image
                  alt="Description"
                  className="w-calc(100%+.32rem) h-auto object-cover" // Adjust size and styling as needed
                />
              </div>
              <span className="text-gray-600 mt-0">Deposit history</span>
            </div>
            
            <div className="flex flex-col items-center">
              <div >
                <img
                  src="https://diuwin.net/assets/png/withdrawHistory-fb2bafcf.png" // Replace this with the actual path to your image
                  alt="Description"
                  className="w-calc(100%+.32rem) h-auto object-cover" // Adjust size and styling as needed
                />
              </div>
              <span className="text-gray-600 mt-0">withdrawl history</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 mt-4 grid-rows-2 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">Lottery</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">TB_Chess</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">jili</span>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">CQ9</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">MG</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">JBD</span>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">DG</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">CMD</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">SaBa</span>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">PG</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">Card365</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">V8Card</span>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">EVO_Video</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">WM_Video</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">SEXY_Video</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">G9</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center">
            <span>0.00</span>
            <span className="text-grey-300">ARGame</span>
          </div>
        </div>
      </div>
      <Footer/>
    </div>
  );
}

export default Wallet;
