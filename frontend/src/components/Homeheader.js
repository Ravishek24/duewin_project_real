import React from 'react'

const Homeheader = () => {
  return (
    <header className="bg-white h-14 flex items-center justify-between top-0 px-2">
      <div className="flex-1"></div>

      {/* Center with logo */}
      <div className="flex items-center mr-48 ">
        <img
          src="https://ossimg.diuacting.com/DiuWin/other/h5setting_20240724134835hng9.png" // Replace with your image path
          alt="Logo"
          className="w-36 h-auto mb-0"
        />
      </div>

      <div className="space-x-2 ml-10 mr-auto">
        <h1>Balance</h1>
        <span className='text-custom-pink text-lg'>0.00</span>
      </div>
    </header>
  )
}

export default Homeheader