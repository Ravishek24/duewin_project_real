import React from 'react';
import CustomerService from '../pages/CustomerService';

const CustomerServiceHeader = () => {
  return (
    <header className="bg-white h-14 flex items-center justify-between top-0 px-2">
      <div className="flex-1"></div>

      {/* Center with logo */}
      <div className="flex items-center mr-12 ">
        <p className='text-black text-2xl '>Agent line Customer service</p>
      </div>

      {/* Right side with flag and dropdown */}
      
    </header>
  );
};

export default CustomerServiceHeader;