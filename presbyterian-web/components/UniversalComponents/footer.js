import { SiFacebook, SiYoutube } from "@icons-pack/react-simple-icons";
import Link from "next/link";


export default function Footer(){

    return(

        <div className="flex flex-col  items-center p-10 bg-blue-900 min-w-full max-w-full overflow-hidden h-52">

            <div className="flex flex-row space-x-4 justify-center mb-5">

             <a><SiFacebook  color="white" size={30}/></a>
             <a><SiYoutube  color="white" size={30}/></a>

            </div>
            
            <div className="flex flex-row space-x-4 justify-center mb-5">
                <Link aria-current="page" href="/" className=" px-6 py-2 rounded-lg  w-fit hover:-translate-1 focus:-translate-1 transition font-bold">Home</Link>
                <Link href="/sermons" className=" px-6 py-2 rounded-lg  w-fit hover:-translate-1 focus:-translate-1 transition font-bold">Sermons</Link>
                <Link href="/projects-and-activities" className=" px-6 py-2 rounded-lg  w-fit hover:-translate-1 focus:-translate-1 transition font-bold">Projects & Activities</Link>
                <Link href="/about" className=" px-6 py-2 rounded-lg  w-fit hover:-translate-1 focus:-translate-1 transition font-bold">About</Link>             
            </div>

            <p>Copyright ©2026 Chilanga Presbyterian Church</p>

        </div>
    )
}