
import Carousel from "@/components/HomeComponents/carousel";
import Contact from "@/components/HomeComponents/ContactComponets/contact-us";
import DailyMessage from "@/components/HomeComponents/daily-message";
import DailyVerse from "@/components/HomeComponents/daily-verse";
import Ministries from "@/components/HomeComponents/ministries";
import Schedule from "@/components/HomeComponents/schedule";
import WelcomeBanner from "@/components/HomeComponents/welcome-banner";
import YearTheme from "@/components/HomeComponents/year-theme";
import { getComponentTypeModule } from "next/dist/server/lib/app-dir-module";
import Image from "next/image";

export default function Home() {

  const slides= [{id: '1',component :<WelcomeBanner/>}, {id: '2',component :<YearTheme/> }, {  id: '3',component :<DailyVerse/>}]


  return (
    
    <div className="container mx-auto max-w-full overflow-hidden min-w-full min-h-screen w-full ">

    <div className="flex w-full  min-h-80 ">

      <Carousel slides={slides}/>
      
    </div>
      

      <main className="flex flex-col h-full items-center">


        <div className="flex flex-col min-w-3/5 h-full lg:max-w-2/5 "> 

        <div className="flex justify-center"> 
              <DailyMessage/>
          </div>

          <div className="flex justify-center"> 
              <Ministries/>
          </div>

          <div className="flex justify-center"> 
              <Schedule/>
          </div>

          <div className="flex justify-center"> 
              <Contact/>
          </div>

        

        </div>



      </main>
  
   </div>
  
  );
}
