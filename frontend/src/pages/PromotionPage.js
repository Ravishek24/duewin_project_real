import React, { useState } from "react";
import Promotionheader from './../components/Promotionheader';

import { Link } from 'react-router-dom';
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
  FaRegCopy,
} from "react-icons/fa";
import { MdOutlineContentCopy } from "react-icons/md";
import Footer from "../components/Footer";

function PromotionPage() {
  const [isPhoneLogin, setIsPhoneLogin] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setverificationCode] = useState("");
  const [privacyAgreement, setPrivacyAgreement] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const invitationCode = 'ABC123XYZ'; // Example invitation code

  const handleCopy = () => {
    // Copy the invitation code to the clipboard
    navigator.clipboard.writeText(invitationCode)
      .then(() => {
        setCopied(true); // Show a message or indicator that it was copied
        setTimeout(() => {
          setCopied(false); // Hide the indicator after 2 seconds
        }, 2000);
      })
      .catch((err) => {
        console.error('Failed to copy: ', err);
      });
  };

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
    <div>
      <Promotionheader/>
    <div className="bg-custom-blue min-h-screen flex flex-col items-center justify-center">
      <div className="text-left mb-10 w-full max-w-md px-8 mt-20">
        <h1 className="text-white text-3xl text-center">0</h1>
        <button
            type="submit" 
            className="w-64 ml-16 mt-2 text-lg bg-custom-pink text-white py-1 rounded-full hover:bg-custom-blue focus:ring-2 focus:ring-gray-300"
          >
            Yesterday's total Commission
          </button>
          <p className="text-white ml-4 mt-2 ">Upgrade the level to increase commission income</p>
      </div>


      <div className="bg-gray-100 p-4 shadow-md w-full max-w-md h-full mt-10 flex flex-col justify-center">
      <div className="bg-white p-4 rounded-lg shadow-md mt-2 mb-4">
      <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-black">
                <span className="font-semibold">Direct subordinates</span>
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-l-2 pl-4 items-center">
              <div className="text-black">
                <span className="font-semibold">Team subordinates</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> number of register
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-l-2 pl-4 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> number of register
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> Deposit number
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-l-2 pl-4 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> Deposit number
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> Deposit amount
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-l-2 pl-4 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> Deposit amount
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> Number of people making first deposit
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-l-2 pl-4 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> Number of people making first deposit
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6 mt-0">
          <button
            type="submit" 
            className="w-full bg-custom-pink text-white py-3 rounded-full hover:bg-custom-blue focus:ring-2 focus:ring-gray-300"
          >
            INVITATION LINK
          </button>
        </form>

        <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center cursor-pointer" onClick={handleCopy}>
          <FaRegFileAlt className="mr-2" />
          <p>Copy invitation code</p>
        </div>
        {/* Invitation code on the right side */}
        <div className="flex items-center space-x-2">
          <span>{invitationCode}</span> {/* Display the invitation code */}
          <button 
            className="flex items-center text-blue-500" 
            onClick={handleCopy}
          >
            <MdOutlineContentCopy className="mr-0" /> {/* Clipboard icon */}

          </button>
        </div>
      </div>
        {copied && <span className="text-green-500 text-sm">Copied!</span>} {/* Optional message when copied */}

    </div>

        <Link to="/subordinate">
        <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <FaRegFileAlt className="fas fa-copy mr-2" />
              <p>Subordinate data</p>
            </div>
            <span className="text-gray-500">{">"}</span>{" "}
          </div>
        </div>
        </Link>

        <Link to="/commissiondetailpage">
        <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <FaRegFileAlt className="fas fa-copy mr-2" />
              <p>Commission detail</p>
            </div>
            <span className="text-gray-500">{">"}</span>{" "}
          </div>
        </div>
        </Link>

        <Link to="/promotionrule">
        <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <FaRegFileAlt className="fas fa-copy mr-2" />
              <p>Invitation rules</p>
            </div>
            <span className="text-gray-500">{">"}</span>{" "}
          </div>
        </div>
        </Link>

        <Link to="/agentcustomer">
        <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <FaRegFileAlt className="fas fa-copy mr-2" />
              <p>Agent line customer service</p>
            </div>
            <span className="text-gray-500">{">"}</span>{" "}
          </div>
        </div>
        </Link>

        <Link to="/rebateratio">
        <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <FaRegFileAlt className="fas fa-copy mr-2" />
              <p>Rebate ratio</p>
            </div>
            <span className="text-gray-500">{">"}</span>{" "}
          </div>
        </div>
        </Link>
        
        <div className="bg-white p-4 rounded-lg shadow-md mt-2 mb-16">
          <h2 className="font-bold mb-6">Promotion data</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> This week
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-l-2 pl-4 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> Total Commission
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> direct subordinate
              </div>
            </div>

            <div className="flex flex-col space-y-2 border-l-2 pl-4 items-center">
              <div className="text-black">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-black">
                <span className="font-semibold"></span> Total number of
                subordinates in the team
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Footer/>
    </div>
  );
}

export default PromotionPage;
