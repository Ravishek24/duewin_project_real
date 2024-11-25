import React from "react";
import ActivityAwardHeader from "../components/ActivityAwardHeader";
import Footer from "./../components/Footer";
import { GiBackwardTime } from "react-icons/gi";
import { BsFileEarmarkRuled } from "react-icons/bs";
import SuperJackpot from "../components/SuperJackpot";
import { PiCrown } from "react-icons/pi";
import { AiFillAppstore } from "react-icons/ai";

const Jackpot = () => {
  return (
    <div className="bg-gray-200 min-h-screen flex flex-col items-center justify-center">
      <div className="text-center mb-0 w-full max-w-md mt-0">
        <div className="min-h-screen bg-gray-200 flex flex-col">
          <SuperJackpot />
          {/* Left 1/4 image section */}
          <div className="bg-custom-blue h-auto flex items-center justify-center relative">
            <img
              src="https://diuwin.net/assets/png/superJackpot-53463ffb.png"
              alt="Descriptive text"
              className="w-full h-auto object-cover"
            />
            {/* Text overlay */}
            <div className="absolute inset-0 flex flex-col items-start justify-start p-4">
              <h1 className="text-white mb-6 text-2xl font-bold">
                Super Jackpot
              </h1>
              <p className="text-white text-xs text-left">
                when you get the super Jackpot in [Slots] <br />
                Can get 1 additional bonus
                <br />
                The reward is valid for 30 day, and you will
                <br />
                not be able to claim it after it express!
              </p>
            </div>
          </div>

          {/* Right 3/4 empty white space */}
          <div className="w-full flex p-4 flex-col items-center justify-center">
          
          <button className="w-full text-sm py-4 rounded-full bg-gray-400 border border-gray-300 text-white hover:bg-custom-blue flex items-center justify-center">
        <AiFillAppstore className="mr-2 text-custom-pink" /> {/* Icon added here with margin-right for spacing */}
        Receive in batches
      </button>
            <div className="grid grid-cols-2 mt-4 gap-2">
              <div className="flex justify-between items-center">
                <span className="rounded text-sm bg-white w-full px-14 p-4 rounded-lg shadow-md mb-2 mt-2 flex items-center">
                  <BsFileEarmarkRuled className="text-black mr-2 font-bold" />{" "}
                  {/* Adds margin-right to the icon */}
                  <p className="text-black">Rule</p>
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="rounded text-sm bg-white w-full px-12 p-4 rounded-lg shadow-md mb-2 mt-2 flex items-center">
                  <PiCrown className="text-black font-bold mr-2" />{" "}
                  {/* Adds margin-right to the icon */}
                  <p className="text-black">winning Star</p>
                </span>
              </div>
            </div>

            <button class="w-full mt-60 text-sm py-4 rounded-full bg-custom-pink border border-gray-300 text-white hover:bg-custom-blue">
              Go bet
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Jackpot;
