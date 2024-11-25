import React, { useState } from "react";
import { Link } from 'react-router-dom';
import { FaPhone, FaEnvelope, FaLock, FaQuestionCircle, FaKey, FaEye,
  FaEyeSlash, } from "react-icons/fa";
import Header from "../components/Header";

function SignupPage() {
  const [isPhoneLogin, setIsPhoneLogin] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [privacyAgreement, setPrivacyAgreement] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prevState) => !prevState);
  };

  const handleInputChange = (setter) => (event) => {
    setter(event.target.value);
  };

  const handleCheckboxChange = (setter) => (event) => {
    setter(event.target.checked);
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
    console.log("Invite code:", inviteCode);
    console.log("Privacy agreement accepted:", privacyAgreement);
  };

  return (

    <div className="bg-custom-blue min-h-screen  flex flex-col items-center justify-center">
      <Header/>
      <div className="text-left mb-0 w-full max-w-md px-10 mt-20">
        <h1 className="text-2xl font-bold text-custom-pink mb-1 mr-4">Register</h1>
        <p className="text-custom-pink text-sm sm:text-base" >
        Please register by phone number or email 
        </p>
      </div>
      <div className="bg-gray-100 p-8 shadow-md w-full max-w-md h-full mt-10 flex flex-col justify-center">
      <div className="flex justify-center mb-4 gap-4">
          <button
            className={`flex flex-col items-center px-6 py-2 font-medium text-xl ${isPhoneLogin ? "text-custom-blue border-b-2 border-custom-pink" : " text-gray-400"}`}
            onClick={() => setIsPhoneLogin(true)}
          >
            <FaPhone className="mb-2" />
            Phone number
          </button>
          <button
            className={`flex flex-col items-center px-6 py-2 font-medium text-xl ${!isPhoneLogin ? "text-custom-blue border-b-2 border-custom-pink" : " text-gray-400"}`}
            onClick={() => setIsPhoneLogin(false)}
          >
            <FaEnvelope className="mb-2" />
            Email Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6 mt-8">
        {isPhoneLogin ? (
            <div>
              <label
                htmlFor="phone"
                className="block mb-2 text-md font-medium text-custom-blue flex items-center gap-1"
              >
                <FaPhone className="text-custom-blue" />
                Phone Number
              </label>
              <input
                type="text"
                id="phone"
                value={phoneNumber}
                onChange={handleInputChange(setPhoneNumber)}
                className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-gray-600 focus:border-gray-600 block w-full p-2.5"
                placeholder="Enter your phone number"
                required
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="email"
                className="block mb-2 text-md font-medium text-gray-900 flex items-center gap-1"
              >
                <FaEnvelope className="text-custom-blue" />
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleInputChange(setEmail)}
                className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-gray-600 focus:border-gray-600 block w-full p-2.5"
                placeholder="name@company.com"
                required
              />
            </div>
          )}
          
          <div className="relative mb-4">
            <div className="flex mb-2 items-center  border-gray-300 relative text-md mt-4 font-medium text-gray-900 gap-1">
              <FaLock className="text-custom-blue" />
              Set Password
            </div>
            <div className="relative w-full mb-4">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Set Password"
                value={password}
                onChange={handleInputChange(setPassword)}
                className="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-teal-600 focus:border-teal-600 block w-full p-2.5 pr-10" 
              />
              <div
                className="absolute top-1/2 right-3 transform -translate-y-1/2 cursor-pointer"
                onClick={togglePasswordVisibility}
              >
                {showPassword ? (
                  <FaEyeSlash className="text-gray-500" />
                ) : (
                  <FaEye className="text-gray-500" />
                )}
              </div>
            </div>
          </div>

          <div className="relative mb-4">
            <div className="flex mb-2 items-center  border-gray-300 relative text-md mt-4 font-medium text-gray-900 gap-1">
              <FaLock className="text-custom-blue" />
              Confirm Password
            </div>
            <div className="relative w-full mb-4">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={password}
                onChange={handleInputChange(setConfirmPassword)}
                className="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-teal-600 focus:border-teal-600 block w-full p-2.5 pr-10" 
              />
              <div
                className="absolute top-1/2 right-3 transform -translate-y-1/2 cursor-pointer"
                onClick={togglePasswordVisibility}
              >
                {showPassword ? (
                  <FaEyeSlash className="text-gray-500" />
                ) : (
                  <FaEye className="text-gray-500" />
                )}
              </div>
            </div>
          </div>


          <div>
            <label htmlFor="inviteCode" className="block mb-2 text-sm font-medium text-gray-900 flex items-center gap-1">
              <FaKey className="text-custom-blue" />
              Invite Code
            </label>
            <input
              type="text"
              id="inviteCode"
              value={inviteCode}
              onChange={handleInputChange(setInviteCode)}
              className="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-gray-600 focus:border-gray-600 block w-full p-2.5"
              placeholder="Please enter your invitation code"
            />
          </div>

          <div className="flex items-start mb-4">
            <input
              id="privacyAgreement"
              type="checkbox"
              checked={privacyAgreement}
              onChange={handleCheckboxChange(setPrivacyAgreement)}
              className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-teal-300"
            />
            <label htmlFor="privacyAgreement" className="ml-2 text-sm text-custom-blue">
              I have read and agree <span className="text-custom-pink">[Privacy Agreement]</span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-custom-pink text-white py-3 rounded-full hover:bg-custom-blue focus:ring-2 focus:ring-gray-300"
          >
            Register
          </button>
          <Link to="/login">
          <button
            type="submit"
            className="w-full bg-white border border-custom-pink text-custom-pink py-3 rounded-full hover:bg-custom-blue focus:ring-2 focus:ring-gray-300"
          >
             i have an account  <span className="font-bold">Login</span>
          </button>
          </Link>
        </form>
      </div>
    </div>
  );
}

export default SignupPage;
