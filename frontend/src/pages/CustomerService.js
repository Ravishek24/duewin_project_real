import React, { useState } from "react";
import {
  FaPhone,
  FaEnvelope,
  FaLock,
  FaQuestionCircle,
  FaKey,
} from "react-icons/fa";
import Header from "../components/Header";

function CustomerService() {
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
      <div className="text-left mb-0 w-full max-w-md px-8 mt-20">
        <h1 className="text-2xl font-bold text-custom-pink mb-1">
          Customer Service
        </h1>
        <p className="text-custom-pink text-sm sm:text-base">
          Hi, can i help you!
        </p>
      </div>

      <div className="bg-gray-100 p-8 shadow-md w-full max-w-md h-full mt-14 flex flex-col justify-center">
        <div className="flex justify-center mb-4 gap-4">
          <button
            className={`flex flex-col items-center px-32 py-2 font-medium text-xl ${isPhoneLogin ? "text-custom-blue border-b-2 border-custom-pink" : " text-gray-600"}`}
            onClick={() => setIsPhoneLogin(true)}
          >
            <FaPhone className="mb-1" />
            Self Service
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6 mt-8">
          <div className="space-y-4">
            {" "}
            {/* Container for vertical spacing */}
            <div>
              <button
                type="button"
                className="block mb-2 text-base font-medium text-gray-900 flex items-center gap-1"
              >
                <FaPhone className="text-custom-blue" />
                Change ID Login Password
                <span className="ml-auto text-gray-500">{">"}</span> {/* Greater-than sign */}
              </button>
              <hr className="my-4 border-gray-300" /> {/* Horizontal line */}
            </div>
            <div>
              <button
                type="button"
                className="block mb-2 text-base font-medium text-gray-900 flex items-center gap-1"
              >
                <FaLock className="text-custom-blue" />
                Retrieve Login ID Account
                <span className="ml-auto text-gray-500">{">"}</span> {/* Greater-than sign */}
              </button>
              <hr className="my-4 border-gray-300" /> {/* Horizontal line */}
            </div>
            <div>
              <button
                type="button"
                className="block mb-10 text-base font-medium text-gray-900 flex items-center gap-1"
              >
                <FaLock className="text-custom-blue" />
                Game Problems
                <span className="ml-auto text-gray-500">{">"}</span> {/* Greater-than sign */}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="verificationCode"
              className="block mb-2  text-lg font-medium text-gray-900 flex items-center gap-1"
            >
              <FaKey className="text-custom-blue" />
              Kind tips
            </label>
            <p className="text-sm">
              1. Please select the corresponding question and submit it for
              review. After successful submission, the customer service
              specialist will handle it for you within 10 minutes. Please wait
              patiently. <br />
              2. 15 minutes after submitting for review, you can use [Progress
              Query] to view the review results of the work order you submitted.
            </p>
          </div>
          <button
            type="submit"
            className="w-full bg-custom-pink text-white py-3 rounded-full hover:bg-custom-blue focus:ring-2 focus:ring-gray-300"
          >
            Progress query
          </button>
        </form>
      </div>
    </div>
  );
}

export default CustomerService;
