import React from 'react';

const Header = () => {
  return (
    <header className="bg-custom-blue fixed top-0 w-auto flex items-center justify-between  ">
      <div className="flex-1"></div>

      {/* Center with logo */}
      <div className="flex items-center mr-14 ml-24">
        <img
          src="https://ossimg.diuacting.com/DiuWin/other/h5setting_20240724134839qf9p.png" // Replace with your image path
          alt="Logo"
          className="w-36 h-auto mb-0"
        />
      </div>

      {/* Right side with flag and dropdown */}
      <div className="flex space-x-0 ml-9 mr-auto">
        <img
          src="https://flagcdn.com/w320/us.png"
          alt="Country Flag"
          className="w-6 h-6 rounded-full"
        />
        <select className="bg-custom-blue text-white px-6">
          <option value="us">EN</option>
          <option value="uk">HN</option>
        </select>
      </div>
    </header>
  );
};

export default Header;
