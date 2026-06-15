import { getLive } from "@/Services/Sermons/youtube"
import NoLive from "./no-live"


export default async function LiveNow({id,title,description}){

    try{
    const liveStatus = await getLive()

    return(

         <div className="flex flex-col mt-10 min-w-full self-center justify-center items-center">
            <div className="flex flex-row items-center justify-center mb-5 min-w-full"> 
            <hr className="min-w-1/5 border-2 bg-red-600 border-red-600 "/>
            <h1 className="text-3xl text-blue-900 my-3 font-bold " >Live Now</h1>
            <hr className="min-w-1/5 border-2 bg-red-600 border-red-600 "/>
            </div>
        <div className="container flex flex-col p-10 rounded-2xl bg-linear-to-br from-blue-950 via-blue-900 to-red-600"> 
  
            <div className="flex flex-row rounded-full  max-w-fit backdrop-blur-md bg-red-600 mb-6 animate-pulse">
             <div className=" h-3 w-3 rounded-full self-center ml-2 bg-white/25 animate-pulse "></div>
             <h2 className=" text-md text-white px-3 py-1 font-bold">LIVE NOW</h2>
            </div>

             <h1 className=" text-white text-2xl text-wrap max-w-2/4 mb-3 ">{liveStatus.title}</h1>
            <div className="flex flex-col md:flex-row mb-4 ">
             <h3 className="text-white w-fit md:mr-5 mb-2 md:mb-0">Reverend T.Mkandawire</h3>

            </div>
             <p className=" w-fit mb-4">{liveStatus.description}</p>
            
            <a className="text-blue-950 bg-white rounded-full p-3 max-w-fit font-semibold " href={`/sermons/${liveStatus.id}`}>Join Live Stream</a>

        </div>
        </div>
    )
    }catch(err){
        console.log(err)

        return(
            <NoLive/>
        )
    } 


} 