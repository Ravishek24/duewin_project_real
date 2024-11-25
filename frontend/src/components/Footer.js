import React from 'react';
import { FaRegPaperPlane, FaRegListAlt, FaHome, FaWallet, FaUserCircle } from 'react-icons/fa'; // Example icons from react-icons
import { IoLogoGameControllerB } from 'react-icons/io5';


function Footer() {
  return (
    <div className="fixed bottom-0  space-x-12 bg-white shadow-lg flex justify-between p-2">
      
      {/* Promotion Tab */}
      <a href="/promotionPage" className="flex flex-col items-center">
        <FaRegPaperPlane className="w-6 h-6 text-gray-500" />
        <span className="text-xs text-gray-700">Promotion</span>
      </a>

      {/* Activity Tab */}
      <a href="/activityPage" className="flex flex-col items-center">
        <FaRegListAlt className="w-6 h-6 text-gray-500" />
        <span className="text-xs text-gray-700">Activity</span>
      </a>

      {/* Home Tab (active) */}
      <a href="/home" className="flex flex-col items-center bg-blue-500 rounded-full p-2">
        <FaHome className="w-12 h-6 text-white" />
      </a>

      {/* Wallet Tab */}
      <a href="/wallet" className="flex flex-col items-center">
        <FaWallet className="w-6 h-6 text-gray-500" />
        <span className="text-xs text-gray-700">Wallet</span>
      </a>

      {/* Account Tab */}
      <a href="/ProfilePage" className="flex flex-col items-center">
        <FaUserCircle className="w-6 h-6 text-gray-500" />
        <span className="text-xs text-gray-700">Account</span>
      </a>
      
    </div>
  );
}

export default Footer;
