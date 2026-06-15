import OtherBanner from "@/components/UniversalComponents/other-page-banner";
import LiveNow from "@/components/SermonsComponents/live-now";
import dynamic from "next/dynamic";

export const revalidate = 3600;

const ArchiveVideos = dynamic(() => import('@/components/SermonsComponents/archive-videos'))

export default async function Sermons(){


    

    
    return(

       <div className="container mx-auto max-w-full overflow-hidden min-w-screen min-h-screen w-full ">
             <div className="flex w-full  min-h-70 ">
            
                  <OtherBanner 
                  title={"Sermons & Messages"} 
                  desc={"Explore biblical teaching and grow in your faith through the Word of God"}
                  />
                  
            </div>


            <main className="flex flex-col h-full items-center ">

                <div className="flex flex-col min-w-11/12 h-full lg:min-w-7/11 lg:max-w-7/11  my-2 px-5 py-5">

            
                    <div className="flex justify-center"> 
                       <LiveNow />
                    </div> 

                    <div className="flex justify-center"> 
                        <ArchiveVideos/>
                    </div>



                 </div>




            </main>




        </div>
    )
}