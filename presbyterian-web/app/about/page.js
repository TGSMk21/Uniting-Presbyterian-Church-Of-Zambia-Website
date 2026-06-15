import ChurchHistory from "@/components/AboutComponents/church-history";
import FindUs from "@/components/AboutComponents/find-us";
import RevBio from "@/components/AboutComponents/reverend-bio";
import OtherBanner from "@/components/UniversalComponents/other-page-banner";




export default function About(){

    return(

        <div className="container mx-auto max-w-full overflow-hidden min-w-full min-h-screen w-full ">

            <div className="flex w-full  min-h-70 ">
            
                  <OtherBanner 
                  title={"About Us"} 
                  desc={"Our story, our vision, and the leadership God has provided"}
                  />
                  
            </div>

            <main className="flex flex-col h-full items-center">

                <div className="flex flex-col min-w-11/12 h-full lg:min-w-7/11 lg:max-w-7/11  my-2 px-5 py-5">

                    <div className="flex justify-center"> 

                        <ChurchHistory/>
                      
                    </div>

                    <div className="flex justify-center"> 

                        <RevBio/>
                       
                    </div>

                     <div className="flex justify-center"> 

                        <FindUs/>
                       
                    </div>



                 </div>




            </main>




        </div>
    )
}