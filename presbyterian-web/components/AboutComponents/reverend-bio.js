import DUMMY_DATA from "@/constants/DUMMY_DATA"
import { Check } from "lucide-react"
import Profile from "./rev-profile"


export default function RevBio (){

    const p1 = "Proident ullamco nulla laboris deserunt nulla adipisicing esse culpa cillum incididunt quis non. Irure Lorem laborum enim ipsum laborum veniam. Sunt incididunt nostrud amet ea aute dolor deserunt eu esse. Pariatur enim pariatur ex do ullamco culpa nostrud proident esse aute cillum adipisicing sint laboris. Eu in pariatur veniam incididunt consequat sunt minim incididunt. Nisi laborum proident eiusmod laborum magna elit laboris elit. Exercitation consequat deserunt consequat cillum Lorem esse pariatur consectetur quis ipsum nulla minim officia adipisicing."

    const p2 ="Ipsum sunt nulla elit deserunt est anim. Laborum aute cupidatat do sunt amet labore in aliqua laboris ex laboris. Magna sint amet ipsum reprehenderit cupidatat do cillum commodo. Ullamco mollit ullamco elit sunt ea ut officia sit sunt nulla magna elit adipisicing. Duis elit adipisicing eu nostrud laboris elit laboris tempor. Laboris sunt qui commodo reprehenderit nisi elit consectetur aute voluptate deserunt consectetur."
    const p3 =" Cillum nostrud tempor consectetur proident sunt tempor elit aliqua dolor culpa do. Ipsum esse do mollit velit voluptate cillum. Ad et ipsum ut non nulla labore. Magna ut nulla Lorem esse non aute adipisicing eiusmod. Irure laborum mollit officia aute enim dolor nostrud."
    const quote = '"My greatest joy in ministry is not seeing a packed sanctuary or hearing applause after a sermon.' + "It's seeing someone's eyes light up when they truly understand the Gospel for the first time."+ "It's watching a broken life made whole by the power of Christ."+" That's what keeps me going—the transformation that only Jesus can bring."+'"'

    const mca = DUMMY_DATA.mca
    return(
        <div className="flex flex-col mt-10">
        <div className="flex flex-col items-center "> 
            <h1 className="text-3xl font-bold text-blue-900 my-3 " ><strong>Meet Our Minister</strong></h1>
            <hr className="min-w-35 max-w-35 border-2 bg-red-600 border-red-600 mb-5"/>
        </div>
        <div className="container grid md:grid-cols-2 gap-3 my-5 mx-auto items-start">
            
            <Profile/>

            <div className="flex flex-col">

                <h1 className="text-blue-950 text-2xl font-bold my-5">Reverend Thomson Mkandawire</h1>

                <h2 className="italic text-gray-600 mb-5">"Called to shepherd, equipped to serve, committed to Christ"</h2>

                <p className="text-gray-600 mb-5">{p1}</p>

                <p className="text-gray-600 mb-5">{p2}</p>

                <p className="text-gray-600 mb-5">{p3}</p>

                <div className="mb-5 flex flex-col rounded-2xl border-l-4 border-l-red-600 p-10 border-2">

                    <h1 className="text-2xl text-blue-950 mb-5 font-bold">Ministry Credentials & Achievements</h1>

                    {mca.map((item) => { return(
                        <div key={item.id} className="flex flex-col">

                            <div className="flex flex-row my-3 items-center">
                                <Check color="red" size={24}/>
                                <p className="text-gray-600 ml-2">{item.point}</p>
                                
                            </div>
                            <hr/>
                        </div>
                    )})}

                </div>

                
               
            </div>
        </div>
        </div>
    )
}