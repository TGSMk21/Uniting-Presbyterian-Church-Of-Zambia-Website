import DUMMY_DATA from "@/constants/DUMMY_DATA";
import { formatYouTubeDuration } from "@/Utilities/durationFomar";
import { getVideos } from "@/Services/Sermons/youtube";
import { Calendar, Play } from "lucide-react";
import Link from "next/link";
import { getArchiveData } from "@/Services/Sermons/ArchiveVidsServicee";
import { mergeData } from "@/Utilities/dataMerge";
import { dateFormat } from "@/Utilities/DateFormatter";

export const  revalidate = 3600;
export default async function ArchiveVideos (){

    try{
    const ytVideos = await getVideos(process.env.YOUTUBE_CHANNEL_ID)

    const vidData = await getArchiveData()

    let videos = ytVideos || []

    if(vidData && vidData.length > 0 && vidData[0] !== null){

        videos = mergeData(ytVideos,vidData)
    }

    return(

         <div className="flex flex-col mt-10 min-w-full">
            <div className="flex flex-row items-center justify-center mb-5 min-w-full"> 
            <hr className="min-w-1/5 border-2 bg-red-600 border-red-600 "/>
            <h1 className="text-3xl text-blue-900 my-3 font-bold " ><strong>Archive Videos</strong></h1>
            <hr className="min-w-1/5 border-2 bg-red-600 border-red-600 "/>
            </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3">

        {videos.map((item,index) => {
                return (

            <div key={item.id} className=" flex flex-col mx-5">


                <Link 

                href={`/sermons/${item.id}`}
                className=" flex flex-col bg-blue-900 justify-end items-end bg-cover bg-center rounded-2xl p-2 min-h-60 " style={{backgroundImage: `url(${item.snippet.thumbnails.high.url})`}} >

                    <h3 className="rounded-lg px-2 py-1 text-sm text-white bg-black/35 self-end bottom-0 ">{formatYouTubeDuration(item.contentDetails.duration)}</h3>

                </Link>
                <div className=" px-3 py-1 mb-5  ">

                    <h2 className="text-red-600 font-semibold mb-5">{item.series}</h2>

                    <h1 className="text-blue-950 text-md font-semibold mb-2">{item.snippet.title}</h1>

                     <div className=" flex flex-row">
                        <Calendar color="gray" size={20}/>
                        <h3 className="text-gray-600 mb-3 md:mr-3 ml-1 text-sm">{dateFormat(item.snippet.publishedAt).fullDate}</h3>
                    </div>
                    
                    <hr className="w-full h-2 mb-2"/>

                    <h3 className="text-gray-500 mb-2">{item.refVerse}</h3>





                </div>

                





            </div>

                
        )})}

            
            
        </div>
        </div>

    )

}catch(err){
    console.log(err)
    return(
        
         <div className="flex flex-col mt-10 min-w-full">
            <div className="flex flex-row items-center justify-center mb-5 min-w-full"> 
            <hr className="min-w-1/5 border-2 bg-red-600 border-red-600 "/>
            <h1 className="text-3xl text-blue-900 my-3 font-bold " ><strong>Archive Videos</strong></h1>
            <hr className="min-w-1/5 border-2 bg-red-600 border-red-600 "/>
            </div>

            <h1 className="w-full text-center py-5 rounded-2xl bg-gray-100 text-xl text-gray-600 font-semibold">No Videos Have Been Uploaded</h1>


        </div>
    )
}

}