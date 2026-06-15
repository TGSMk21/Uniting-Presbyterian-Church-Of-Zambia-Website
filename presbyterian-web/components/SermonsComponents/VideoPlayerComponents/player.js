import { formatYouTubeDuration } from "@/Utilities/durationFomar";
import { getVideos } from "@/Services/Sermons/youtube";
import { BookOpenText, Calendar, Clock, Link } from "lucide-react";
import YouTube from "react-youtube";
import { getArchiveData } from "@/Services/Sermons/ArchiveVidsServicee";
import { dateFormat } from "@/Utilities/DateFormatter";

export const revalidate = 3600;

export default async function VidPlayerPage({id}) {

     const videos = await getVideos(process.env.YOUTUBE_CHANNEL_ID)

     const videoData = await getArchiveData()

    const videoId = await id 

    const vidDetails = {...videos.find((v) => v.id === videoId), ...videoData.find((v) => v.id === videoId)}

    return(
    <div className="container lg:grid lg:grid-cols-3 gap-5 mx-auto overflow-hidden min-w-full max-w-full">
        <div className="flex flex-col col-span-2">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-blue-950 min-h-fit">

                <iframe
                    className="w-full  min-h-93"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                    title="Hello"
                    allow= "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope;picture-in-picture; web-share"
                    allowFullScreen/>
            </div>
            <div className=' flex flex-col p-10 border-2 my-5 rounded-2xl  '>

                <h2 className="text-red-500 bg-red-200 max-w-fit py-1 px-3 rounded-2xl ">{vidDetails.series}</h2>

                <h1 className="text-blue-950 text-xl my-5 font-normal">{vidDetails.snippet.title}</h1>

                <div className="flex flex-col md:flex-row items-start "> 
                    <div className=" flex flex-row">
                    <Calendar color="gray" size={15}/>
                    <h3 className="text-gray-600 mb-3 md:mr-3 ml-1 text-sm leading-none font-semibold">{dateFormat(vidDetails.snippet.publishedAt).fullDate}</h3>
                    </div>
                    <div className=" flex flex-row  ">
                    <Clock color="gray" size={15} />
                    <h3 className="text-gray-600 mb-3 md:mr-3 ml-1 text-sm leading-none font-semibold">{formatYouTubeDuration(vidDetails.contentDetails.duration)}</h3>
                    </div>
                    <div className=" flex flex-row ">
                    <BookOpenText color="gray" size={15} className=""/>
                    <h3 className="text-gray-600 mb-3 md:mr-3 ">{vidDetails.refVerse}</h3>
                    </div>

                    
                </div>

                <hr className="mb-5"/>

                <h2 className="text-blue-950 mb-5 font-semibold">About This Sermon</h2>
                <p className="text-gray-600 text-wrap">{vidDetails.snippet.description}</p>


            </div>
        </div>
        <div className="flex flex-col min-w-full">
            <div className="flex flex-col justify-center items-center p-5 bg-blue-950 rounded-2xl">

                <h2 className="text-gray-200 text-lg">Related Videos</h2>
                

            </div>

           
            <div className="flex flex-col p-10  rounded-2xl border-2 mt-5">
            

                {videos.filter((v) => v.id !== videoId).map((item) => {
                    return(
                    <div key={item.id} className="flex flex-col"
                    
                    > 
                    <div className="flex flex-row mb-5 items-center">
                    <a className="flex flex-col rounded-lg min-w-34 min-h-32 p-1 justify-end items-end mr-3 bg-center bg-cover"  style={{backgroundImage: `url(${item.snippet.thumbnails.high.url})`}} href={`/sermons/${item.id}`}>
                        <span className=" rounded-lg px-1 py-1 text-sm text-white bg-black/35 self-end bottom-0 ">{formatYouTubeDuration(item.contentDetails.duration)}</span>
                    </a>
                    <div className="flex flex-col mb-3">
                        <a className="text-blue-950 mb-3 text-md" href={`/sermons/${item.id}`}>{item.snippet.title}</a>
                        <div className=" flex flex-row">
                        <Calendar color="gray" size={15}/>
                        <h3 className="text-gray-600 mb-3 md:mr-3 ml-1 text-sm leading-none font-semibold">{dateFormat(item.snippet.publishedAt).fullDate}</h3>
                        </div>
                        <a className="text-gray-600" href={`/sermons/${item.id}`}></a>
                    </div>
                    </div>
                    <hr className="min-w-full mb-3"/>
                </div>
                        
                    )
                })}
                


            </div>


        </div>
    </div>
    )
}