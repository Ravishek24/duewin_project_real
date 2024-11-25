import React, { useState } from "react";
import { FaPhone, FaEnvelope, FaLock, FaQuestionCircle, FaKey } from "react-icons/fa";
import {Link} from 'react-router-dom'
import Header from "../components/Header";

function ForgotPassword() {
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
  const handleConfirmPasswordChange = (event) => setConfirmPassword(event.target.value);
  const handleverificationCodeChange = (event) => setverificationCode(event.target.value);
  const handlePrivacyAgreementChange = (event) => setPrivacyAgreement(event.target.checked);
  const handleRememberPasswordChange = (event) => setRememberPassword(event.target.checked);


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
    const loginData = isPhoneLogin ? { phoneNumber, password } : { email, password };
    console.log("Login data:", loginData);
    console.log("Remember password:", rememberPassword);
    console.log("verification code:", verificationCode);
    console.log("Privacy agreement accepted:", privacyAgreement);
  };

  return (
    <div className="bg-custom-blue min-h-screen flex flex-col items-center justify-center">
      <Header/>
      <div className="text-left mb-0 w-full max-w-md px-8 mt-20">
        <h1 className="text-2xl font-bold text-custom-pink mb-1">Forgot Password</h1>
        <p className="text-custom-pink text-sm sm:text-base">
          Please retrive/change your password through your mobile phone number or email
        </p>
      </div>

      <div className="bg-gray-100 p-8 shadow-md w-full max-w-md h-full mt-10 flex flex-col justify-center">
        <div className="flex justify-center mb-4 gap-4">
          <button
            className={`flex flex-col items-center px-32  font-medium text-xl ${isPhoneLogin ? "text-custom-blue border-b-2 border-custom-pink" : " text-gray-600"}`}
            onClick={() => setIsPhoneLogin(true)}
          >
            <FaPhone className="mb-1" />
            Phone reset
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6 mt-4">
          {isPhoneLogin && (
            <div>
              <label htmlFor="phone" className="block mb-2 text-sm font-medium text-gray-900 flex items-center gap-1">
                <FaPhone className="text-custom-blue" />
                Phone Number
              </label>
              <input
                type="text"
                id="phone"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-gray-600 focus:border-gray-600 block w-full p-2.5"
                placeholder="Enter your phone number"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-900 flex items-center gap-1">
              <FaLock className="text-custom-blue" />
              Set Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={handlePasswordChange}
              className="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-gray-600 focus:border-gray-600 block w-full p-2.5"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block mb-2 text-sm font-medium text-gray-900 flex items-center gap-1">
              <FaLock className="text-custom-blue" />
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              className="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-gray-600 focus:border-gray-600 block w-full p-2.5"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label htmlFor="verificationCode" className="block mb-2 text-sm font-medium text-gray-900 flex items-center gap-1">
              <FaKey className="text-custom-blue" />
              Verification Code
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="verificationCode"
                value={verificationCode}
                onChange={handleverificationCodeChange}
                className="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-gray-600 focus:border-gray-600 block w-full p-2.5"
                placeholder="Enter your verification code"
              />
              <button
                type="button"
                onClick={handleSendVerificationCode}
                className="bg-custom-pink text-white px-4 py-2 rounded-full hover:bg-custom-blue focus:ring-2 focus:ring-gray-300"
              >
                Send
              </button>
            </div>
          </div>

          <div className="flex items-start mb-4">
            <input
              id="privacyAgreement"
              type="checkbox"
              checked={privacyAgreement}
              onChange={handlePrivacyAgreementChange}
              className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-gray-300"
            />
            <label htmlFor="privacyAgreement" className="ml-2 text-sm text-custom-pink">
              I agree to the privacy policy
            </label>
          </div>
          <Link to='/login'>
          <button
            type="submit"
            className="w-full bg-custom-pink text-white py-3 rounded-full hover:bg-custom-blue focus:ring-2 focus:ring-gray-300"
          >
            Reset
          </button>
          </Link>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
