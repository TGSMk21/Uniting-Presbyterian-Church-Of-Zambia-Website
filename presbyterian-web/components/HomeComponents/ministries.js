import Image from "next/image";


export default function Ministries(){

    const dministries = [

        {id: "1", title: "Youth Ministry" ,img: "/youthMin.png", description: "Empowering young hearts to live boldly for Christ through worship, discipleship, and fellowship that transforms lives.", verse: '"Let no one despise you for your youth, but set the believers an example in speech, in conduct, in love, in faith, in purity." ',v :"- 1 Timothy 4:12", }, 
        {id: "2", title: "Childrens Ministry" ,img: "/cm.png", description: "Planting seeds of faith in young hearts through engaging Bible lessons, worship, and activities that make God's love real." , verse: '"Train up a child in the way he should go; even when he is old he will not depart from it." ',v :"- Proverbs 22:6",},
        {id: "3", title: "Men's Ministry" ,img: "/mm.png" ,description: "Building godly men of integrity through brotherhood, accountability, and purpose-driven discipleship in Christ.", verse: '"As iron sharpens iron, so one man sharpens another." ',v :"- Proverbs 27:17", },
        {id: "4", title: "Women's Ministry" ,img:"/wm.png", description: "Nurturing women of faith to discover their God-given purpose through prayer, study, and authentic community.", verse: '"She is clothed with strength and dignity, and she laughs without fear of the future." ',v :"- Proverbs 31:25", },


    ];

    return(
        <div className="flex flex-col items-center min-w-full md:min-w-fit "> 
            <div className="flex flex-col items-center "> 
            <h1 className="text-2xl font-bold text-blue-900 my-3 "><strong>Our Ministries</strong></h1>
            <hr className="max-w-35 min-w-35 border-2 bg-red-600 border-red-600 mb-5 self-center"/>
            </div>
        <div className=" container grid max-md:grid-rows-2 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 max-lg:gap-10 p-5 justify-center md:min-w-fit min-w-full  items-center lg:gap-5 max-sm:gap-5  "> 
           

        {dministries.map((item) => { return(
        <div key={item.id} className="flex flex-row md:flex-col col-span-1 justify-center items-center w-full py-2 md:py-5 px-0 border-2 rounded-lg  md:max-w-80  md:self-center shadow-lg border-l-4 border-l-blue-900 hover:border-l-red-700 delay-150 ease-in-out transform transition-transform hover:-translate-y-1 hover:scale-105 pl-5 md:pl-0 md:min-h-full md:justify-start"> 
            <img
            loading="lazy"
            src={item.img}
            className=" h-40 w-fit rounded-lg mb-3"
            />
            <div className="flex flex-col max-w-fit pl-3 md:items-center  md:pl-0">
            <h1 className="w-fit text-blue-900 text-xl font-bold">{item.title}</h1>
            <p className=" text-wrap md:text-center text-left text-gray-500 my-2 max-w-3/3">{item.verse}</p>
            <p className=" text-wrap md:text-center text-left text-gray-500 my-0 max-w-3/3 italic">{item.v}</p>
            <p className=" text-wrap md:text-center text-left text-gray-500 my-2 max-w-3/3">{item.description}</p>
            </div>
        </div>)
        })}

        </div>
        </div>

    )



}