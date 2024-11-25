import React from "react";
import ActivityAwardHeader from "../components/ActivityAwardHeader";
import Footer from "./../components/Footer";
import { GiBackwardTime } from "react-icons/gi";
import { BsFileEarmarkRuled } from "react-icons/bs";
import SuperJackpot from "../components/SuperJackpot";
import { PiCrown } from "react-icons/pi";
import { AiFillAppstore } from "react-icons/ai";
import GiftHeader from "../components/GiftHeader";
import { VscEmptyWindow } from "react-icons/vsc";
import { BiNotepad } from "react-icons/bi";

const Gift = () => {
  return (
    <div className="bg-gray-200 min-h-screen flex flex-col items-center justify-center">
      <div className="text-center mb-0 w-full max-w-md mt-0">
        <div className="min-h-screen bg-gray-200 flex flex-col">
          <GiftHeader />
          {/* Left 1/4 image section */}
          <div className="bg-custom-blue h-auto flex items-center justify-center relative">
            <img
              src="https://diuwin.net/assets/png/gift-d7507b9b.png"
              alt="Descriptive text"
              className="w-full h-auto object-cover"
            />
            {/* Text overlay */}
          </div>

          {/* Right 3/4 empty white space */}
          <div className="w-full flex p-4 flex-col items-center justify-center">
            <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4 w-full">
              <div class="flex flex-col items-start">
                <h2 class="text-lg text-custom-blue">Hi</h2>
                <h2 class="text-lg text-custom-blue">We have a gift for you</h2>
              </div>

              <div class="flex flex-col items-start">
                <h2 class="text-lg font-bold mt-6 text-custom-blue">
                  Please enter the gift code below
                </h2>
              </div>

              <div class="mt-4 ">
                <input
                  type="text"
                  placeholder="Please enter gift code"
                  class="w-full bg-gray-100 p-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button class="mt-4 w-full py-3 rounded-full bg-custom-pink border border-custom-pink text- white font-bold hover:bg-custom-blue hover:text-white">
                Receive
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md mb-2 mt-4 w-full">
              <div class="flex  items-start">
                <BiNotepad className="mt-2" />
                <h2 class="text-lg text-custom-blue">History</h2>
              </div>

              <div className="flex items-center justify-center">
                <VscEmptyWindow className="w-20 h-auto text-gray-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Gift;
