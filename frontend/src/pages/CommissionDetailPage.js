import React, { useState, useEffect } from "react";
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
import CommissionDetail from "../components/CommissionDetail";

function CommissionDetailPage() {
  const [date, setDate] = useState("");

  // Function to get today's date in the required format
  const getTodaysDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0"); // Get month and ensure 2 digits
    const day = today.getDate().toString().padStart(2, "0"); // Get day and ensure 2 digits

    return `${year}-${month}-${day}`; // Return in the format yyyy-mm-dd
  };

  useEffect(() => {
    // Set today's date when the component mounts
    setDate(getTodaysDate());
  }, []);

  return (
    <div className="bg-white min-h-screen flex flex-col items-center justify-center">
      <div className="text-center mb-0 w-full max-w-md px-8 ">
        <h1 className="text-2xl font-sans text-black mb-1">
          Commission Details
        </h1>
      </div>

      <div className="bg-gray-100 p-4 shadow-md w-full max-w-md h-full mt-4 flex flex-col justify-center">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex justify-between items-center">
            <input
              type="date"
              className="rounded-lg p-4 text-lg shadow-md mb-2 mt-2 w-full border-gray-300"
              value={date} // Set the value to today's date in yyyy-mm-dd format
              onChange={(e) => setDate(e.target.value)} // Optional: handle any date change
            />
          </div>
        </div>

        <div className="bg-gray-100 p-8 rounded-lg  mt-2 mb-56">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-gray-100">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-gray-100">
                <span className="font-semibold"></span> Deposit number
              </div>
            </div>

            <div className="flex flex-col space-y-2 pl-4 items-center">
              <div className="text-gray-100">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-gray-100">
                <span className="font-semibold"></span> Deposit amount
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-gray-100">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-gray-100">
                <span className="font-semibold"></span> Number of bettors
              </div>
            </div>

            <div className="flex flex-col space-y-2 pl-4 items-center">
              <div className="text-gray-100">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-gray-100">
                <span className="font-semibold"></span> Total bet
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex flex-col space-y-2 items-center">
              <div className="text-gray-100">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-gray-100">
                <span className="font-semibold"></span> Number of people making
                first deposit
              </div>
            </div>

            <div className="flex flex-col space-y-2 pl-4 items-center">
              <div className="text-gray-100">
                <span className="font-semibold">0</span>
              </div>
              <div className="text-gray-100">
                <span className="font-semibold"></span> First deposit amount
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommissionDetailPage;
