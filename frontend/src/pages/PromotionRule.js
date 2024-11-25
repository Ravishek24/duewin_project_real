import React, { useState } from "react";
import Promotionruleheader from "./../components/PromotionRuleHeader";
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
} from "react-icons/fa";
import PromotionRuleheader from "./../components/PromotionRuleHeader";

function PromotionRule() {
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
      <PromotionRuleheader />
      <div className="bg-gray-100 min-h-screen flex flex-col items-center justify-center">
        <div className="text-left mb-4 w-full max-w-md px-8 mt-4">
          <h1 className="text-custom-blue text-xl font-bold text-center">
            [Promotion partner] program
          </h1>

          <p className="text-custom-pink text-sm text-center ml-4 mt-2 ">
            this activity is valid for a long time
          </p>
        </div>

        <div className="bg-gray-100 p-4 shadow-md w-full max-w-md h-full  flex flex-col justify-center">
          <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <p>
                  There are 6 subordinate levels in inviting friends, if A
                  invites B, then B is a level 1 subordinate of A. If B invites
                  C, then C is a level 1 subordinate of B and also a level 2
                  subordinate of A. If C invites D, then D is a level 1
                  subordinate of C, at the same time a level 2 subordinate of B
                  and also a level 3 subordinate of A.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <p>
                  When inviting friends to register, you must send the
                  invitation link provided or enter the invitation code manually
                  so that your friends become your level 1 subordinates.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <p>
                  The invitee registers via the inviter's invitation code and
                  completes the deposit, shortly after that the commission will
                  be received immediately
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <p>
                  The calculation of yesterday's commission starts every morning
                  at 01:00. After the commission calculation is completed, the
                  commission is rewarded to the wallet and can be viewed through
                  the commission collection record.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <p>
                  Commission rates vary depending on your agency level on that
                  day
                  <br /> Number of Teams: How many downline deposits you have to
                  date. <br /> Team Deposits: The total number of deposits made
                  by your downline in one day. <br /> Team Deposit: Your
                  downline deposits within one day.{" "}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md mb-2 mt-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <p>
                  The commission percentage depends on the membership level. The
                  higher the membership level, the higher the bonus percentage.
                  Different game types also have different payout percentages.{" "}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PromotionRule;
