import React from 'react'

const GiftHeader = () => {
  return (
    <header className="bg-white h-14 flex items-center justify-between top-0 px-2">
      <div className="flex-1"></div>

      {/* Center with logo */}
      <div className="flex items-center">
        <p className='text-black text-2xl'>Gift</p>
      </div>
    </header>
  )
}

export default GiftHeader;