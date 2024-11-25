import React from 'react';
import RebateRatio from '../pages/RebateRatio';

const RebateRatioHeader = () => {
  return (
    <header className="bg-white h-14 flex items-center justify-between top-0 px-2">
      <div className="flex-1"></div>

      {/* Center with logo */}
      <div className="flex items-center mr-40">
        <p className='text-black text-2xl '>Rebate ratio</p>
      </div>

      {/* Right side with flag and dropdown */}
      <div className="flex   ml-2 mr-auto">
        
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

export default RebateRatioHeader;