import React from 'react';
import CustomerServiceHeader from '../components/CustomerServiceHeader';

const AgentCustomer = () => {
  return (
    <div className="bg-gray-200 min-h-screen flex flex-col items-center justify-center">
      <div className="text-center mb-0 w-full max-w-md  mt-0">
        <div className="min-h-screen bg-gray-200 flex flex-col">
          <CustomerServiceHeader />
          {/* Left 1/4 image section */}
          <div className="bg-custom-blue h-auto flex items-center justify-center">
            <img
              src="https://diuwin.net/assets/png/serverbg-79bda3b1.png"
              alt="Descriptive text"
              className="w-full h-auto object-cover"
            />
          </div>
          
          {/* Right 3/4 empty white space */}
          <div className="w-3/4 flex flex-col items-center justify-center">
            {/* Additional content can be added here */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentCustomer;
