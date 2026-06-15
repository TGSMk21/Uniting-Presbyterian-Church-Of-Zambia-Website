import DUMMY_DATA from "@/constants/DUMMY_DATA"
import { getUpcomingStreams } from "@/Services/Sermons/UpcomingStreamService"


export default async function NoLive (){
    try{
    const upcoming = await getUpcomingStreams()

    return(
         <div className="flex flex-col mt-10 min-w-full">
            <div className="flex flex-row items-center justify-center mb-5 min-w-full"> 
            <hr className="min-w-1/5 border-2 bg-red-600 border-red-600 "/>
            <h1 className="text-3xl text-blue-900 my-3 font-bold " ><strong>Live Now</strong></h1>
            <hr className="min-w-1/5 border-2 bg-red-600 border-red-600 "/>
            </div>
        <div className=" flex flex-col min-w-full px-5 py-2">
            <div className="container min-w-full flex flex-col justify-center items-center p-10 rounded-t-2xl bg-linear-to-br from-blue-950 via-blue-900 to-red-600"> 

             <h1 className=" text-white text-2xl text-wrap  mb-3 ">We'll Be Back Soon</h1>
            
             <p className=" w-fit mb-4">No live stream at the moment, but we'd love to see you at our next service!</p>

            </div>
            <div className="flex flex-col rounded-b-2xl border-2 bg-white   p-10">

             <h1 className="text-blue-900 text-xl font-semibold ml-2 mb-5">Upcoming Live Streams</h1>

             <div className="flex flex-col min-w-full"> 

            {upcoming.map((item) => {
                return(
             <div key={item._id} className="flex flex-col rounded-lg ml-2 mb-4 bg-gray-100 border-l-4 border-l-red-600 p-5">

             <h2 className="text-gray-600  font-bold mb-2">{item.series}</h2>

             <h1 className="text-blue-950 text-xl font-semibold mb-2">{item.title}</h1>

             <h2 className="text-gray-600  font-semibold mb-3">{item.startTime} - {item.endTime}</h2>

             <h2 className="text-gray-600  font-semibold mb-3">{item.date}</h2>
             
             </div>
                )
            })}
            
            

             </div>
             
            </div>
        


        </div>
        </div>
    )

}catch(err){

    return(

        <div className="flex flex-col mt-10 min-w-full">
            <div className="flex flex-row items-center justify-center mb-5 min-w-full"> 
            <hr className="min-w-1/5 border-2 bg-red-600 border-red-600 "/>
            <h1 className="text-3xl text-blue-900 my-3 font-bold " ><strong>Live Now</strong></h1>
            <hr className="min-w-1/5 border-2 bg-red-600 border-red-600 "/>
            </div>
            <div className=" flex flex-col min-w-full px-5 py-2">
            <div className="container min-w-full flex flex-col justify-center items-center p-10 rounded-t-2xl bg-linear-to-br from-blue-950 via-blue-900 to-red-600"> 

             <h1 className=" text-white text-2xl text-wrap  mb-3 ">We'll Be Back Soon</h1>
            
             <p className=" w-fit mb-4">No live stream at the moment, but we'd love to see you at our next service!</p>

            </div>
            <div className="flex flex-col rounded-b-2xl border-2 bg-white   p-10">

                <h1 className="text-blue-900 text-xl  ml-2 mb-5 self-center"><strong>No Upcoming Live Streams</strong></h1>

            </div>
        


            </div>
        </div> 
    )
}

}