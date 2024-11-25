import React, { useState } from "react";
import { Link } from 'react-router-dom';
import {
  FaPhone,
  FaEnvelope,
  FaLock,
  FaQuestionCircle,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import Header from "../components/Header";


function LoginPage() {
  const [isPhoneLogin, setIsPhoneLogin] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handlePhoneNumberChange = (event) => {
    setPhoneNumber(event.target.value);
  };

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  const handleRememberPasswordChange = (event) => {
    setRememberPassword(event.target.checked);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const loginData = isPhoneLogin
      ? { phoneNumber, password }
      : { email, password };
    console.log("Login data:", loginData);
    console.log("Remember password:", rememberPassword);
  };

  return (
    <div className="bg-custom-blue min-h-screen flex flex-col items-center justify-center">
      <Header/>
      <div className="text-left mb-0 w-full max-w-md px-8 mt-20">
        <h1 className="text-2xl font-bold text-custom-pink mb-1">Login</h1>
        <p className="text-custom-pink text-sm sm:text-base">
          Please log in with your phone number or email
          <br />
          if you forget your password, please contact customer service
        </p>
      </div>

      <div className="bg-gray-100 p-8 shadow-md w-full max-w-md h-3/4 mt-10 flex flex-col justify-center">
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
            Email login
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6 mt-6">
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
                onChange={handlePhoneNumberChange}
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
                onChange={handleEmailChange}
                className="border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-gray-600 focus:border-gray-600 block w-full p-2.5"
                placeholder="name@company.com"
                required
              />
            </div>
          )}

          <div className="relative mb-4">
            <div className="flex mb-2 items-center  border-gray-300 relative text-md mt-4 font-medium text-gray-900 gap-1">
              <FaLock className="text-custom-blue" />
              Password
            </div>
            <div className="relative w-full mb-4">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={handlePasswordChange}
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

          <div className="flex items-center justify-between ">
            <div className="flex items-start mb-2 mt-2">
              <input
                id="remember"
                type="checkbox"
                checked={rememberPassword}
                onChange={handleRememberPasswordChange}
                className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-teal-300"
              />
              <label
                htmlFor="remember"
                className="ml-2 text-sm text-custom-pink"
              >
                Remember me
              </label>
            </div>
            <a
              href="#"
              className="text-sm font-medium text-custom-pink hover:underline"
            >
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className="w-full bg-custom-pink text-white py-3 rounded-full hover:bg-custom-blue focus:ring-2 focus:ring-indigo-300"
          >
            Login
          </button>
          <Link to="/signup">
          <button
            type="button"
            className="w-full border text-black py-2 rounded-full border-2 border-black hover:bg-custom-blue hover:text-white focus:ring-2 focus:ring-indigo-300"
          >
            Register
          </button>
          </Link>

          <div className="flex justify-between ">
          <Link to="/forgotPassword">
            <div className="flex flex-col items-center mt-2">
              
              <FaLock className="text-custom-pink mb-1 text-3xl" />{" "}
              {/* Reduced margin bottom */}
              <button
                type="button"
                className="text-md text-custom-blue hover:underline"
              >
                Forgot Password
              </button>
            </div>
            </Link>
            <Link to="/CustomerService">
            <div className="flex flex-col items-center mt-2">
              <FaQuestionCircle className="text-custom-pink mb-1 text-3xl" />{" "}
              {/* Reduced margin bottom */}
              <button
                type="button"
                className="text-md text-custom-blue hover:underline"
              >
                Customer Service
              </button>
            </div>
            </Link>
          </div>

          {/* <p className="text-sm font-light text-gray-500">
            Don’t have an account yet?{" "}
            <a href="#" className="font-medium text-teal-600 hover:underline">
              Sign up
            </a>
          </p> */}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
