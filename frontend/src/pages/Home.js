import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaVolumeUp } from "react-icons/fa";
import {
  FaHome,
  FaSearch,
  FaUser,
  FaShoppingCart,
  FaCog,
} from "react-icons/fa";
import Footer from "../components/Footer";
import Homeheader from "../components/Homeheader";
import { Element } from "react-scroll";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

<style jsx>{`
  .button-container::-webkit-scrollbar {
    display: none; /* Hides the scrollbar */
  }

  .button-container {
    -ms-overflow-style: none; /* Hides scrollbar in IE and Edge */
    scrollbar-width: none; /* Hides scrollbar in Firefox */
  }
`}</style>;

function Home() {
  const [activeButton, setActiveButton] = useState(null);
  const [sliderData, setSliderData] = useState([
    {
      id: 1,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827175238lien.png", // Replace with your image URL
      alt: "Slide 1 Image",
    },
    {
      id: 2,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240828152235lvxc.png", // Replace with your image URL
      alt: "Slide 2 Image",
    },
    {
      id: 3,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827175238lien.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 4,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827175355rwqi.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 5,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240826140214u7o9.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 6,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827175238lien.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 7,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827175238lien.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 8,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827175238lien.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 9,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827175238lien.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 10,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827175238lien.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 11,
      imgSrc:
        "https://ossimg.diuacting.com/DiuWin/banner/Banner_20240827175238lien.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
  ]);

  const [cardData, setCardData] = useState([
    {
      id: 1,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/gamelogo/TB_Chess/810.png", // Replace with your image URL
      alt: "Slide 1 Image",
    },
    {
      id: 2,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/45.png", // Replace with your image URL
      alt: "Slide 2 Image",
    },
    {
      id: 3,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/51.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 4,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/gamelogo/TB_Chess/100.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 5,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/51.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 6,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/45.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 7,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/223.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 8,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/51.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 9,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/119.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 10,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/gamelogo/TB_Chess/106.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
  ]);

  const slidesettings = {
    infinite: true,
    speed: 500,
    slidesToShow: 3, // Show 3 slides at once
    slidesToScroll: 3, // Scroll 3 slides at once
    arrows: false,
    autoplay: true, // Enable autoplay
    autoplaySpeed: 2000, // Set autoplay speed
  };

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: false,
    autoplay: true, // Automatically change slides
    autoplaySpeed: 2000, // Change slide every 2 seconds
  };

  // Function to handle button click
  const handleButtonClick = (buttonId) => {
    setActiveButton(buttonId); // Update the active button state
  };

  const buttonData = [
    { id: 0, title: "Home", icon: <FaHome /> },
    { id: 1, title: "Search", icon: <FaSearch /> },
    { id: 2, title: "Profile", icon: <FaUser /> },
    { id: 3, title: "Cart", icon: <FaShoppingCart /> },
    { id: 4, title: "Settings", icon: <FaCog /> },
  ];

  const [lotterycardData, setlotteryCardData] = useState([
    {
      id: 1,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/lotterycategory/lotterycategory_20240730135644c9au.png", // Replace with your image URL
      alt: "Slide 1 Image",
    },
    {
      id: 2,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/lotterycategory/lotterycategory_20240730135652xdlu.png", // Replace with your image URL
      alt: "Slide 2 Image",
    },
    {
      id: 3,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/lotterycategory/lotterycategory_202407301356593l49.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
    {
      id: 4,
      imgSrc: "https://ossimg.diuacting.com/DiuWin/lotterycategory/lotterycategory_2024073013570787wd.png", // Replace with your image URL
      alt: "Slide 3 Image",
    },
  ]);


  const cardgridData = {
    0: [
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/229.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/224.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/51.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/223.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/JILI/109.png" },
      // { title: "Home Card 6", image: "https://via.placeholder.com/150" },
    ],
    1: [
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/CQ9/19.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/CQ9/117.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/CQ9/103.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/CQ9/10.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/CQ9/113.png" },
    ],
    2: [
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/MG/SMG_wildfireWins.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/MG/SMG_10000Wishes.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/MG/SMG_777RoyalWheel.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/MG/SMG_4DiamondBlues.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/MG/SMG_25000Talons.png" },
    ],
    3: [
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/PG/103.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/PG/54.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/PG/87.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/PG/98.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/PG/40.png" },
    ],
    4: [
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/EVO_Electronic/reelheist0000000.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/EVO_Electronic/grandwheel000000.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/EVO_Electronic/777strike0000000.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/EVO_Electronic/777superstrike00.png" },
      { image: "https://ossimg.diuacting.com/DiuWin/gamelogo/EVO_Electronic/101candiesr96f10.png" },
    ],
  };

  return (
    <div className=" min-h-screen flex flex-col items-center justify-center ">
      <Homeheader />

      <div className=" bg-gray-100  shadow-md w-full max-w-md h-full mt-0 flex flex-col justify-center  bg-gray-100 ">
        <div className="w-full py-4 bg-gray-100 ">
          <div className="container mx-auto px-4 ">
            <Slider {...settings}>
              {sliderData.map((slide) => (
                <img
                  src={slide.imgSrc}
                  alt={slide.alt}
                  className="w-full h-auto object-cover rounded-lg shadow-lg"
                />
              ))}
            </Slider>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 p-4 shadow-md w-full max-w-md h-full mt-0 flex flex-col justify-center">
        <div className="bg-white p-2 rounded-full shadow-md  mt-0">
          <div className="flex justify-between items-center w-full">
            <FaVolumeUp className="text-custom-blue ml-2 text-2xl" />
            <button className="bg-custom-blue  text-white p-2 px-8 rounded-full">
              Detail
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 px-4 shadow-md w-full max-w-md h-full mt-0 flex flex-col justify-center">
        <div className="container">
          {/* Navigation buttons to scroll to sections */}
          <div className="button-container  flex overflow-x-auto scrollbar-hidden whitespace-nowrap space-x-4">
            <Link
              to="section1"
              smooth={true}
              duration={500}
              className="scroll-button inline-block w-16 h-16"
            >
              <img
                src="https://ossimg.diuacting.com/DiuWin/gamecategory/gamecategory_20240722092600jsn4.png"
                alt="Go to Section 1"
                className="button-img"
              />
            </Link>
            <Link
              to="section2"
              smooth={true}
              duration={500}
              className="scroll-button inline-block w-16 h-16"
            >
              <img
                src="https://ossimg.diuacting.com/DiuWin/gamecategory/gamecategory_20240722092552pj7d.png"
                alt="Go to Section 2"
                className="button-img"
              />
            </Link>
            <Link
              to="section3"
              smooth={true}
              duration={500}
              className="scroll-button inline-block w-16 h-16"
            >
              <img
                src="https://ossimg.diuacting.com/DiuWin/gamecategory/gamecategory_20240722092542sh85.png"
                alt="Go to Section 3"
                className="button-img"
              />
            </Link>
            <Link
              to="section1"
              smooth={true}
              duration={500}
              className="scroll-button inline-block w-16 h-16"
            >
              <img
                src="https://ossimg.diuacting.com/DiuWin/gamecategory/gamecategory_20240722092452swfv.png"
                alt="Go to Section 1"
                className="button-img"
              />
            </Link>
            <Link
              to="section2"
              smooth={true}
              duration={500}
              className="scroll-button inline-block w-16 h-16"
            >
              <img
                src="https://ossimg.diuacting.com/DiuWin/gamecategory/gamecategory_20240722092502uryl.png"
                alt="Go to Section 2"
                className="button-img"
              />
            </Link>
            <Link
              to="section2"
              smooth={true}
              duration={500}
              className="scroll-button inline-block  w-16 h-16"
            >
              <img
                src="https://ossimg.diuacting.com/DiuWin/gamecategory/gamecategory_20240722092524eyc6.png"
                alt="Go to Section 2"
                className="button-img"
              />
            </Link>
            <Link
              to="section2"
              smooth={true}
              duration={500}
              className="scroll-button inline-block w-16 h-16"
            >
              <img
                src="https://ossimg.diuacting.com/DiuWin/gamecategory/gamecategory_20240722092533461f.png"
                alt="Go to Section 2"
                className="button-img"
              />
            </Link>
            <Link
              to="section3"
              smooth={true}
              duration={500}
              className="scroll-button inline-block w-16 h-16"
            >
              <img
                src="https://ossimg.diuacting.com/DiuWin/gamecategory/gamecategory_20240722092510alv1.png"
                alt="Go to Section 3"
                className="button-img"
              />
            </Link>
          </div>

          <div className="bg-gray-100 w-full max-w-md h-full mt-0 flex flex-col justify-center">
            <h2 className="text-2xl  text-gray-800">Super Jackpot</h2>
            <p className="text-sm">
              when you win a super jackpot, you will receive additional rewards
            </p>
            <p className="text-sm mt-4">
              Maximum bonus <span className="text-custom-pink">300.00</span>
            </p>
          </div>

          <div className="w-full py-2 bg-gray-100 ">
            <div className="container mx-auto ">
              <Slider {...slidesettings}>
                {cardData.map((slide) => (
                  <div key={slide.id} className="px-2">
                    <img
                      src={slide.imgSrc}
                      alt={slide.alt}
                      className="w-full h-auto object-cover rounded-lg shadow-lg"
                    />
                  </div>
                ))}
              </Slider>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 p-4 shadow-md w-full max-w-md h-full mb-0 flex flex-col justify-center">
        <div className="bg-white p-2 rounded-full shadow-md mb-2 mt-0">
          <div className="flex justify-center items-center w-full">
            <h2 className=" text-custom-blue p-1 px-8 rounded-full">
              Look super jackpot
            </h2>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 p-4  w-full max-w-md h-full mt-0 flex flex-col justify-center">
        <h2 className="text-2xl  text-gray-800">Slots</h2>
        <p className="text-sm">
          Online real-time game dealers, all verified fair games
        </p>
      </div>
      <div className="bg-gray-100 px-4 shadow-md w-full max-w-md h-full mb-0 flex flex-col justify-center">
        {/* Button Container */}
        <div className="bg-white rounded-lg shadow-md mb-4">
          <div className="button-container justify-center flex ">
            {buttonData.map((button) => (
              <button
                key={button.id}
                onClick={() => handleButtonClick(button.id)}
                className={`flex flex-col items-center p-4 rounded-lg w-24 h-auto transition-all duration-300
                ${activeButton === button.id ? "bg-black text-white" : "bg-white text-gray-600"} 
                hover:bg-black`}
                style={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  className="icon"
                  style={{ fontSize: "24px", marginBottom: "8px" }}
                >
                  {button.icon}
                </div>
                <span>{button.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-3 gap-4  rounded-lg ">
          {cardgridData[activeButton]?.map((card, index) => (
            <div
              key={index}
              className="rounded-lg text-center  hover:shadow-lg transition-all duration-300"
            >
              {/* Access the specific properties of the object */}
              <img
                src={card.image} // Access the 'image' property
                alt={card.title} // Access the 'title' property for alt text
                className="w-full h-auto object-cover rounded-md mb-2"
              />
            </div>
          ))}
        </div>

      </div>

      <div className="bg-gray-100 px-4 shadow-md w-full max-w-md h-full mt-0 flex flex-col justify-center">
      <div className="bg-gray-100 w-full max-w-md h-full mt-0 flex flex-col justify-center">
            <h2 className="text-2xl  text-gray-800">Lottery</h2>
            <p className="text-sm">
              when you win a super jackpot, you will receive additional rewards
            </p>
          </div>

          <div className="w-full py-2 bg-gray-100 ">
            <div className="container mx-auto ">
              <Slider {...slidesettings}>
                {lotterycardData.map((slide) => (
                  <div key={slide.id} className="px-2">
                    <img
                      src={slide.imgSrc}
                      alt={slide.alt}
                      className="w-full h-auto object-cover rounded-lg shadow-lg"
                    />
                  </div>
                ))}
              </Slider>
            </div>
          </div>
      </div>
      <Footer />
    </div>
  );
}

export default Home;
