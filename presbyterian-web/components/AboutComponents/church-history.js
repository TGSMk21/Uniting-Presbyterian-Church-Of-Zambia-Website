import DUMMY_DATA from "@/constants/DUMMY_DATA"
import Vision from "./vision"
import Mission from "./our-mission"



export default function ChurchHistory () {

    const data = DUMMY_DATA.about

    const ourH = 'Chilanga Presbyterian Church was born from a simple prayer meeting in 1985. A small group of believers, united by a vision to see lives transformed by the Gospel, began gathering in a living room to pray for their community.'  

    const ourH2 = 'What started as weekly gatherings of 12 people has grown into a vibrant congregation of over 2,000 members. Throughout our journey, we have witnessed countless testimonies of salvation, healing, restoration, and breakthrough.'

    const ourH3 = "From our humble beginnings, God has expanded our reach and influence. We have weathered storms, celebrated victories, and remained steadfast in our commitment to preach the Gospel and disciple believers. Our history is a testament to God's faithfulness."

    const points = DUMMY_DATA.vp

    return(
        <div className="flex flex-col mt-10 ">
            <div className="flex flex-col items-center mb-5"> 
            <h1 className="text-3xl text-blue-900 my-3 font-bold " ><strong>Our Church</strong></h1>
            <hr className="min-w-35 max-w-35 border-2 bg-red-600 border-red-600 mb-5"/>
            </div>
        <Mission/>
        <div className="container grid md:grid-cols-2 min-w-full gap-3 max-w-full">
            
        <div className= " flex flex-col p-10 border-2 border-l-4 border-l-red-600 rounded-2xl min-w-full ">

            <h1 className="text-blue-950 font-bold text-2xl mb-5"><strong>Our History</strong></h1>

            <h2 className="text-red-600 px-3 py-1 font-bold rounded-2xl bg-red-100 max-w-fit">Founded 1985</h2>

            <p className="text-gray-800 my-5 text-wrap">{ourH}</p>

            <p className="text-gray-800 mb-5 text-wrap">{ourH2}</p>

            <p className="text-gray-800 text-wrap ">{ourH3}</p>

        </div>

        <Vision></Vision>

        </div>
        
        </div>
    )


}