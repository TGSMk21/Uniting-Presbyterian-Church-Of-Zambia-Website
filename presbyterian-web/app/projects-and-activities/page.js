import OtherBanner from "@/components/UniversalComponents/other-page-banner";
import Activity from "@/components/Projects&ActivityComponents/activities";
import Projects from "@/components/Projects&ActivityComponents/projects";


export default function ProjectsAndActivities(){

    return(

        <div className="container mx-auto max-w-full overflow-hidden min-w-full min-h-screen w-full ">

             <div className="flex w-full  min-h-70 ">
            
                  <OtherBanner 
                  title={"Projects & Activities"} 
                  desc={"Join us in making a difference in our community and growing together in faith"}
                  />
                  
            </div>

            <main className="flex flex-col h-full items-center">
  
               <div className="flex flex-col min-w-11/12 h-full lg:min-w-7/11 lg:max-w-7/11  my-2 px-5 py-5">

                    <div className="flex justify-center"> 
                        <Projects/>
                    </div>

                    <div className="flex justify-center w-full"> 
                        <Activity></Activity>
                    </div>



                 </div>




            </main>




        </div>
    )
}