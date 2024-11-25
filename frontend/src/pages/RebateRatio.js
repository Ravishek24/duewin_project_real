import React, { useState } from "react";
import Promotionruleheader from "./../components/PromotionRuleHeader";
import { VscIssues } from "react-icons/vsc";
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
  FaStar,
} from "react-icons/fa";
import PromotionRuleheader from "./../components/PromotionRuleHeader";
import RebateRatioHeader from "../components/RebateRatioHeader";

function RebateRatio() {
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
    <div>
      <RebateRatioHeader />
      <div className="bg-gray-100 min-h-screen flex flex-col items-center justify-center">
        <div className="text-left  w-full max-w-md px-8 ">
        
        <div className="overflow-x-auto flex space-x-4 px-4 py-4" >
      <div className="bg-white p-4 rounded-lg shadow-md px-8 mb-2 mt-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="items-center">
            <FaStar className="text-yellow-500 mr-2" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md mb-2 px-8 mt-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="items-center">
            <FaStar className="text-yellow-500 mr-2" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md mb-2 px-8 mt-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="items-center">
            <FaStar className="text-yellow-500 mr-2" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md mb-2 px-8 mt-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="items-center">
            <FaStar className="text-yellow-500 mr-2" />
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md mb-2 px-8 mt-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div className="items-center">
            <FaStar className="text-yellow-500 mr-2" />
          </div>
        </div>
      </div>
    </div>

          <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4">
            <div className="flex justify-between items-center">
              <div className="items-center ">
                <h2 className=" text-xl">
                  Rebate level{" "}
                  <span className="text-custom-pink font-bold italic">L1</span>
                </h2>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    1 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    2 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    3 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    4 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    5 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    6 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4">
            <div className="flex justify-between items-center">
              <div className="items-center ">
                <h2 className=" text-xl">
                  Rebate level{" "}
                  <span className="text-custom-pink font-bold italic">L2</span>
                </h2>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    1 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    2 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    3 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    4 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    5 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    6 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4">
            <div className="flex justify-between items-center">
              <div className="items-center ">
                <h2 className=" text-xl">
                  Rebate level{" "}
                  <span className="text-custom-pink font-bold italic">L3</span>
                </h2>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    1 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    2 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    3 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    4 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    5 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    6 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4">
            <div className="flex justify-between items-center">
              <div className="items-center ">
                <h2 className=" text-xl">
                  Rebate level{" "}
                  <span className="text-custom-pink font-bold italic">L4</span>
                </h2>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    1 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    2 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    3 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    4 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    5 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    6 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4">
            <div className="flex justify-between items-center">
              <div className="items-center ">
                <h2 className=" text-xl">
                  Rebate level{" "}
                  <span className="text-custom-pink font-bold italic">L5</span>
                </h2>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    1 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    2 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    3 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    4 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    5 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
                <div className="flex justify-between items-center">
                  <p>
                    <VscIssues className="inline-block mr-2 text-custom-pink" />{" "}
                    6 level lower level commission rebate
                  </p>
                  <span className="text-gray-500 ml-8">0%</span>{" "}
                  {/* Add the value here */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
  );
}

export default RebateRatio;
