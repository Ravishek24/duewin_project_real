import React from "react";
import ActivityAwardHeader from "../components/ActivityAwardHeader";
import Footer from "./../components/Footer";
import { GiBackwardTime } from "react-icons/gi";

const ActivityAward = () => {
  return (
    <div className="bg-gray-200 min-h-screen flex flex-col items-center justify-center">
      <div className="text-center mb-0 w-full max-w-md mt-0">
        <div className="min-h-screen bg-gray-200 flex flex-col">
          <ActivityAwardHeader />
          {/* Left 1/4 image section */}
          <div className="bg-custom-blue h-auto flex items-center justify-center relative">
            <img
              src="https://diuwin.net/assets/png/award_bg-00eaec82.png"
              alt="Descriptive text"
              className="w-full h-auto object-cover"
            />
            {/* Text overlay */}
            <div className="absolute inset-0 flex flex-col items-start justify-start p-4">
              <h1 className="text-white text-2xl font-bold">Activity Award</h1>
              <p className="text-white text-xs text-left">
                Compare weekly/daily tasks to receive rich <br />
                rewards
                <br />
                Weekly reward cannot be accumulated to the <br />
                next week, and daily rewards cannot be <br /> accumulated to the
                next day.
              </p>
            </div>
          </div>

          {/* Right 3/4 empty white space */}
          <div className="w-full flex p-4 flex-col items-center justify-center">
            <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4 w-full">
              <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-green-500">Daily mission</h2>
                <span class="text-gray-500 ">Unfinished</span>
              </div>

              <div class="mt-4 flex items-center">
                <img
                  src="https://i.ibb.co/X2r7hV6/777.png"
                  alt="Slot"
                  class="h-8"
                />
                <span class="ml-2 mr-2 text-sm  text-gray-600">
                  slot betting bonus
                </span>
                <span class=" text-red-500 font-bold ">0/100000</span>
              </div>

              <div class="mt-4 ">
                <input
                  type="text"
                  placeholder="slot betting bonus"
                  class="w-full bg-gray-100 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="mt-2 flex ">
                <span class="text-gray-600 text-sm mr-40">Award amount</span>
                <div class="flex mt-0 justify-end">
                  <img
                    src="https://i.ibb.co/1R4yY5r/wallet.png"
                    alt="Wallet"
                    class="h-6"
                  />
                  <span class="ml-2 text-orange-500 font-bold">₹1,000.00</span>
                </div>
              </div>

              <button class="mt-4 w-full py-3 rounded-full bg-white border border-custom-pink text- white font-bold hover:bg-green-600">
                to complete
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4 w-full">
              <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-green-500">Daily mission</h2>
                <span class="text-gray-500 ">Unfinished</span>
              </div>

              <div class="mt-4 flex items-center">
                <img
                  src="https://i.ibb.co/X2r7hV6/777.png"
                  alt="Slot"
                  class="h-8"
                />
                <span class="ml-2 mr-2 text-sm  text-gray-600">
                  slot betting bonus
                </span>
                <span class=" text-red-500 font-bold ">0/100000</span>
              </div>

              <div class="mt-4 ">
                <input
                  type="text"
                  placeholder="slot betting bonus"
                  class="w-full bg-gray-100 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="mt-2 flex ">
                <span class="text-gray-600 text-sm mr-40">Award amount</span>
                <div class="flex mt-0 justify-end">
                  <img
                    src="https://i.ibb.co/1R4yY5r/wallet.png"
                    alt="Wallet"
                    class="h-6"
                  />
                  <span class="ml-2 text-orange-500 font-bold">₹1,000.00</span>
                </div>
              </div>

              <button class="mt-4 w-full py-3 rounded-full bg-white border border-custom-pink text- white font-bold hover:bg-green-600">
                to complete
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4 w-full">
              <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-green-500">Daily mission</h2>
                <span class="text-gray-500 ">Unfinished</span>
              </div>

              <div class="mt-4 flex items-center">
                <img
                  src="https://i.ibb.co/X2r7hV6/777.png"
                  alt="Slot"
                  class="h-8"
                />
                <span class="ml-2 mr-2 text-sm  text-gray-600">
                  slot betting bonus
                </span>
                <span class=" text-red-500 font-bold ">0/100000</span>
              </div>

              <div class="mt-4 ">
                <input
                  type="text"
                  placeholder="slot betting bonus"
                  class="w-full bg-gray-100 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="mt-2 flex ">
                <span class="text-gray-600 text-sm mr-40">Award amount</span>
                <div class="flex mt-0 justify-end">
                  <img
                    src="https://i.ibb.co/1R4yY5r/wallet.png"
                    alt="Wallet"
                    class="h-6"
                  />
                  <span class="ml-2 text-orange-500 font-bold">₹1,000.00</span>
                </div>
              </div>

              <button class="mt-4 w-full py-3 rounded-full bg-white border border-custom-pink text- white font-bold hover:bg-green-600">
                to complete
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4 w-full">
              <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-green-500">Daily mission</h2>
                <span class="text-gray-500 ">Unfinished</span>
              </div>

              <div class="mt-4 flex items-center">
                <img
                  src="https://i.ibb.co/X2r7hV6/777.png"
                  alt="Slot"
                  class="h-8"
                />
                <span class="ml-2 mr-2 text-sm  text-gray-600">
                  slot betting bonus
                </span>
                <span class=" text-red-500 font-bold ">0/100000</span>
              </div>

              <div class="mt-4 ">
                <input
                  type="text"
                  placeholder="slot betting bonus"
                  class="w-full bg-gray-100 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="mt-2 flex ">
                <span class="text-gray-600 text-sm mr-40">Award amount</span>
                <div class="flex mt-0 justify-end">
                  <img
                    src="https://i.ibb.co/1R4yY5r/wallet.png"
                    alt="Wallet"
                    class="h-6"
                  />
                  <span class="ml-2 text-orange-500 font-bold">₹1,000.00</span>
                </div>
              </div>

              <button class="mt-4 w-full py-3 rounded-full bg-white border border-custom-pink text- white font-bold hover:bg-green-600">
                to complete
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4 w-full">
              <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-green-500">Daily mission</h2>
                <span class="text-gray-500 ">Unfinished</span>
              </div>

              <div class="mt-4 flex items-center">
                <img
                  src="https://i.ibb.co/X2r7hV6/777.png"
                  alt="Slot"
                  class="h-8"
                />
                <span class="ml-2 mr-2 text-sm  text-gray-600">
                  slot betting bonus
                </span>
                <span class=" text-red-500 font-bold ">0/100000</span>
              </div>

              <div class="mt-4 ">
                <input
                  type="text"
                  placeholder="slot betting bonus"
                  class="w-full bg-gray-100 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="mt-2 flex ">
                <span class="text-gray-600 text-sm mr-40">Award amount</span>
                <div class="flex mt-0 justify-end">
                  <img
                    src="https://i.ibb.co/1R4yY5r/wallet.png"
                    alt="Wallet"
                    class="h-6"
                  />
                  <span class="ml-2 text-orange-500 font-bold">₹1,000.00</span>
                </div>
              </div>

              <button class="mt-4 w-full py-3 rounded-full bg-white border border-custom-pink text- white font-bold hover:bg-green-600">
                to complete
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4 w-full">
              <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-green-500">Daily mission</h2>
                <span class="text-gray-500 ">Unfinished</span>
              </div>

              <div class="mt-4 flex items-center">
                <img
                  src="https://i.ibb.co/X2r7hV6/777.png"
                  alt="Slot"
                  class="h-8"
                />
                <span class="ml-2 mr-2 text-sm  text-gray-600">
                  slot betting bonus
                </span>
                <span class=" text-red-500 font-bold ">0/100000</span>
              </div>

              <div class="mt-4 ">
                <input
                  type="text"
                  placeholder="slot betting bonus"
                  class="w-full bg-gray-100 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="mt-2 flex ">
                <span class="text-gray-600 text-sm mr-40">Award amount</span>
                <div class="flex mt-0 justify-end">
                  <img
                    src="https://i.ibb.co/1R4yY5r/wallet.png"
                    alt="Wallet"
                    class="h-6"
                  />
                  <span class="ml-2 text-orange-500 font-bold">₹1,000.00</span>
                </div>
              </div>

              <button class="mt-4 w-full py-3 rounded-full bg-white border border-custom-pink text- white font-bold hover:bg-green-600">
                to complete
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4 w-full">
              <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-green-500">Daily mission</h2>
                <span class="text-gray-500 ">Unfinished</span>
              </div>

              <div class="mt-4 flex items-center">
                <img
                  src="https://i.ibb.co/X2r7hV6/777.png"
                  alt="Slot"
                  class="h-8"
                />
                <span class="ml-2 mr-2 text-sm  text-gray-600">
                  slot betting bonus
                </span>
                <span class=" text-red-500 font-bold ">0/100000</span>
              </div>

              <div class="mt-4 ">
                <input
                  type="text"
                  placeholder="slot betting bonus"
                  class="w-full bg-gray-100 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="mt-2 flex ">
                <span class="text-gray-600 text-sm mr-40">Award amount</span>
                <div class="flex mt-0 justify-end">
                  <img
                    src="https://i.ibb.co/1R4yY5r/wallet.png"
                    alt="Wallet"
                    class="h-6"
                  />
                  <span class="ml-2 text-orange-500 font-bold">₹1,000.00</span>
                </div>
              </div>

              <button class="mt-4 w-full py-3 rounded-full bg-white border border-custom-pink text- white font-bold hover:bg-green-600">
                to complete
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4 w-full">
              <div class="flex justify-between items-center">
                <h2 class="text-xl font-bold text-green-500">Daily mission</h2>
                <span class="text-gray-500 ">Unfinished</span>
              </div>

              <div class="mt-4 flex items-center">
                <img
                  src="https://i.ibb.co/X2r7hV6/777.png"
                  alt="Slot"
                  class="h-8"
                />
                <span class="ml-2 mr-2 text-sm  text-gray-600">
                  slot betting bonus
                </span>
                <span class=" text-red-500 font-bold ">0/100000</span>
              </div>

              <div class="mt-4 ">
                <input
                  type="text"
                  placeholder="slot betting bonus"
                  class="w-full bg-gray-100 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="mt-2 flex ">
                <span class="text-gray-600 text-sm mr-40">Award amount</span>
                <div class="flex mt-0 justify-end">
                  <img
                    src="https://i.ibb.co/1R4yY5r/wallet.png"
                    alt="Wallet"
                    class="h-6"
                  />
                  <span class="ml-2 text-orange-500 font-bold">₹1,000.00</span>
                </div>
              </div>

              <button class="mt-4 w-full py-3 rounded-full bg-white border border-custom-pink text- white font-bold hover:bg-green-600">
                to complete
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ActivityAward;
