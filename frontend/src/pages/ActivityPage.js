import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaPhone,
  FaEnvelope,
  FaLock,
  FaQuestionCircle,
  FaKey,
} from "react-icons/fa";
import Header from "../components/Header";
import Footer from "../components/Footer";

function ActivityPage() {
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
      <Header />
      <div className="text-left mb-0 w-full max-w-md px-8 mt-20">
        <h1 className="text-2xl font-bold text-custom-pink mb-1">Activity</h1>
        <p className="text-custom-pink text-sm sm:text-base">
          Please Remember to follow the event page
          <br />
          We will launch user feedback activities from time to time
        </p>
      </div>

      <div className="bg-gray-100 p-4 shadow-md w-full max-w-md h-full mt-4 flex flex-col justify-center">
        <div className="grid grid-cols-3 items-center mb-6">
          <div className="text-center">
            <Link to="/activityaward">
              <img
                src="https://diuwin.net/assets/png/activityReward-66772619.png"
                alt="Target"
                className="w-12 h-12 mx-auto"
              />
              <div>
                Activity <br /> Award
              </div>
            </Link>
          </div>
          <div className="text-center">
            <Link to="/rebate">
              <img
                src="https://diuwin.net/assets/png/BettingRebate-17d35455.png"
                alt="Idea"
                className="w-12 h-12 mx-auto"
              />
              <div>
                Betting
                <br />
                Rebate
              </div>{" "}
            </Link>
          </div>
          <div className="text-center">
            <Link to="/jackpot">
              <img
                src="https://diuwin.net/assets/png/superJackpot-ecb648b4.png"
                alt="Idea"
                className="w-12 h-12 mx-auto"
              />
              <div>
                Super
                <br />
                Jackpot
              </div>{" "}
            </Link>
          </div>
        </div>

        <div className="flex justify-between items-center mb-0">
          <div className="flex justify-between items-center mb-6">
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="h-50 bg-white rounded-lg shadow-md flex flex-col">
                <Link to="/Gift">
                <div className="w-full h-2/4 mb-2">
                  <img
                    src="https://diuwin.net/assets/png/signInBanner-33f86d3f.png"
                    alt="description"
                    className="w-full h-80% object-cover rounded-t-lg"
                  />
                </div>
                <div className="w-full h-1/4 flex flex-col items-left justify-center mb-10 p-2">
                  <h2 className="text-lg font-semibold mb-1 ">Gifts</h2>
                  <p className="text-gray-700 text-xs ">
                    Enter the redemption code to receive gift rewards
                  </p>
                </div>
                </Link>
              </div>

              <div className="h-50 bg-white rounded-lg shadow-md flex flex-col">
              <Link to="/AttendanceBonus">
                <div className="w-full h-2/4 mb-2">
                  <img
                    src="https://diuwin.net/assets/png/giftRedeem-45917887.png"
                    alt="description"
                    className="w-full h-80% object-cover rounded-t-lg"
                  />
                </div>
                <div className="w-full h-1/4 flex flex-col items-left justify-center mb-8 p-2">
                  <h2 className="text-lg font-semibold">Attendance Bonus</h2>
                  <p className="text-gray-700 text-xs ">
                    The more consecutive days you sign in, the higher the reward
                    will be.
                  </p>
                </div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className=" bg-white rounded-lg shadow-md flex flex-col mb-6">
          <div>
            <img
              src="https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827180534ickk.png"
              alt="Descriptive Alt Text"
              className="w-full h-auto rounded"
            />
          </div>
          <div className="w-full h-1/4 flex flex-col items-left justify-center  p-4">
            <h2 className="text-lg font-semibold">First Deposit Bonus</h2>
            {/* <p className="text-gray-700 text-sm ">
              The more consecutive days you sign in, the higher the reward will
              be.
            </p> */}
          </div>
        </div>

        <div className=" bg-white rounded-lg shadow-md flex flex-col mb-6">
          <div>
            <img
              src="https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827175709gnr5.png"
              alt="Descriptive Alt Text"
              className="w-full h-auto rounded"
            />
          </div>
          <div className="w-full h-1/4 flex flex-col items-left justify-center p-4">
            <h2 className="text-lg font-semibold">Daily Bonus</h2>
            {/* <p className="text-gray-700 text-sm ">
              The more consecutive days you sign in, the higher the reward will
              be.
            </p> */}
          </div>
        </div>

        <div className=" bg-white rounded-lg shadow-md flex flex-col mb-6">
          <div>
            <img
              src="https://ossimg.diuacting.com/DiuWin/banner/Banner_20240828174930butj.png"
              alt="Descriptive Alt Text"
              className="w-full h-auto rounded"
            />
          </div>
          <div className="w-full h-1/4 flex flex-col items-left justify-center  p-4">
            <h2 className="text-lg font-semibold">Aviator Challenger</h2>
            {/* <p className="text-gray-700 text-sm ">
              The more consecutive days you sign in, the higher the reward will
              be.
            </p> */}
          </div>
        </div>

        <div className=" bg-white rounded-lg shadow-md flex flex-col mb-6">
          <div>
            <img
              src="https://ossimg.diuacting.com/DiuWin/banner/Banner_20240828175051yb1x.png"
              alt="Descriptive Alt Text"
              className="w-full h-auto rounded"
            />
          </div>
          <div className="w-full h-1/4 flex flex-col items-left justify-center  p-4">
            <h2 className="text-lg font-semibold">Lucky 10 days</h2>
            {/* <p className="text-gray-700 text-sm ">
              The more consecutive days you sign in, the higher the reward will
              be.
            </p> */}
          </div>
        </div>

        <div className=" bg-white rounded-lg shadow-md flex flex-col mb-6">
          <div>
            <img
              src="https://ossimg.diuacting.com/DiuWin/banner/Banner_20240828175144x8p1.png"
              alt="Descriptive Alt Text"
              className="w-full h-auto rounded"
            />
          </div>
          <div className="w-full h-1/4 flex flex-col items-left justify-center p-4">
            <h2 className="text-lg font-semibold">wingo win streak Bonus</h2>
            {/* <p className="text-gray-700 text-sm ">
              The more consecutive days you sign in, the higher the reward will
              be.
            </p> */}
          </div>
        </div>

        <div className=" bg-white rounded-lg shadow-md flex flex-col mb-4">
          <div>
            <img
              src="https://ossimg.diuacting.com/DiuWin/banner/Banner_202408291537368dtv.png"
              alt="Descriptive Alt Text"
              className="w-full h-auto rounded"
            />
          </div>
          <div className="w-full h-1/4 flex flex-col items-left justify-center p-4">
            <h2 className="text-lg font-semibold">Diuwin Content Creators</h2>
            {/* <p className="text-gray-700 text-sm ">
              The more consecutive days you sign in, the higher the reward will
              be.
            </p> */}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default ActivityPage;
