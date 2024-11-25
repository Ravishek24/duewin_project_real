import React from 'react'
import { GiBackwardTime } from "react-icons/gi";

const ActivityAward = () => {
  return (
    <header className="bg-white h-14 flex items-center justify-between top-0 px-2">
      <div className="flex-1"></div>

      {/* Center with logo */}
      <div className="flex items-center mr-4">
      <GiBackwardTime  className="text-black text-sm mr-2 w-8 h-8" /> 
        <p className='text-black text-sm '> Collection record</p>
      </div>

      {/* Right side with flag and dropdown */}
      
    </header>
  )
}

export default ActivityAward