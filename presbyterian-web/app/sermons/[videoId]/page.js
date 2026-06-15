import VidPlayerPage from "@/components/SermonsComponents/VideoPlayerComponents/player";


export default async function VidPlayer({params}) {

    const resolvedParams = await params;

    const id = resolvedParams.videoId

 
    return(

        <div className="container mx-auto max-w-full overflow-hidden min-w-full min-h-screen w-full ">


            <main className="flex flex-col h-full items-center">

                <div className="flex flex-col min-w-11/12 h-full  my-2 px-5 py-5">

                    <div className="flex justify-center"> 

                        <VidPlayerPage id={id}/>
                       
                    </div>

                    <div className="flex justify-center"> 
                      
                    </div>



                 </div>




            </main>




        </div>
    )
}