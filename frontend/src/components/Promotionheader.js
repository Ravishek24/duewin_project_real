import React from 'react';

const Promotionheader = () => {
  return (
    <header className="bg-white h-14 flex items-center justify-between top-0 px-2">
      <div className="flex-1"></div>

      {/* Center with logo */}
      <div className="flex items-center mr-20">
        <p className='text-black text-2xl '>Agency</p>
      </div>

      {/* Right side with flag and dropdown */}
      <div className="flex  space-x-2 ml-10 mr-auto">
        <img
          src="https://flagcdn.com/w320/us.png"
          alt="Country Flag"
          className="w-6 h-6 rounded-full"
        />
        <span className='text-white text-xl'>EN</span>
        {/* <select className="bg-custom-blue text-white ">
          <option value="us">US</option>
          <option value="uk">UK</option>
          <option value="ca">CA</option>
          <option value="au">AU</option>
        </select> */}
      </div>
    </header>
  );
};

export default Promotionheader;
