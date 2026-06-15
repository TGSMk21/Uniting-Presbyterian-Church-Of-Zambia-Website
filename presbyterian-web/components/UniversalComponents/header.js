'use client';
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";


export default function Header(){

    const [isOpen, setIsOpen] = useState(false)

    const toggleMenu = () => {
        setIsOpen(!isOpen)
    }

    const pathname = usePathname()

    useEffect( ()=>{
        if(isOpen)
            document.body.style.overflow ='hidden'
        else
            document.body.style.overflow ='unset'
    },[isOpen])

    return(
        <>
        <nav className="flex flex-row w-full overflow-hidden items-center place-content-between p-5 bg-blue-900 h-20 ">

            <button className="mr-5 lg:hidden" onClick={() => toggleMenu() } >
                <Menu size={24} color="white" className=""/>
            </button>
            
            <div className="flex flex-row py-2 px-6 object-contain items-center min-w-2/3">
                <img
                 loading="lazy"            
                src="/logo.png"
                href="/"
                className="w-15 h-15 object-contain"
                />
                <a href="/" className="text-2xl font-semibold min-w-2/3 ">Chilanga Presbyterian Church</a>
            </div>

            

            <div className="flex flex-row space-x-4   invisible lg:visible">
            <Link aria-current="page" href="/" className={ clsx(" px-6 py-2 rounded-lg  w-fit transform transition-transform font-semibold", {'bg-red-500/30 text-red-500 -translate-1': pathname === '/'} )}>Home</Link>
            <Link href="/sermons" className={ clsx(" px-6 py-2 rounded-lg  w-fit transform transition-transform font-semibold", {'bg-red-500/30 text-red-500 -translate-1': pathname === '/sermons'} )}>Sermons</Link>
            <Link href="/projects-and-activities" className={ clsx(" px-6 py-2 rounded-lg  w-fit transform transition-transform font-semibold", {'bg-red-500/30 text-red-500 -translate-1': pathname === '/projects-and-activities'} )}>Projects & Activities</Link>
            <Link href="/about" className={ clsx(" px-6 py-2 rounded-lg  w-fit transform transition-transform font-semibold", {'bg-red-500/30 text-red-500 -translate-1': pathname === '/about'} )}>About</Link>             
            </div>
        </nav>

        <div className={`min-h-full max-h-full min-w-2/5 max-w-2/5 flex flex-col p-2 bg-blue-900 absolute top-0 left-0 inset-0 z-60 transform transition-transform duration-300 ease-in-out translate-0  ${isOpen ? 'translate-x-0' : '-translate-x-full'}  `} >

                <div className='flex flex-row justify-end mb-5 h-fit pt-3 '>

                    <button  onClick={() => toggleMenu()} className="w-full  max-h-fit rounded-2xl">

                        <X size={24} color="white"/>

                    </button>
                    
                </div>
                < hr className="my-3  border-gray-500"/>
                <div className=" flex flex-col w-full">
                    <Link aria-current="page" onClick={() => toggleMenu()} href="/" className=" px-6 py-2 rounded-lg  w-full  hover:-translate-1 focus:-translate-1 transition font-bold">Home</Link>
                    <hr className="my-3 border-gray-500"/>
                </div>
                <div className=" flex flex-col w-full">
                     <Link href="/sermons" onClick={() => toggleMenu()} className=" px-6 py-2 rounded-lg  w-fit  hover:-translate-1 focus:-translate-1 transition font-bold">Sermons</Link>
                    <hr className="my-3 border-gray-500"/>
                </div>
                <div className=" flex flex-col w-full">
                     <Link href="/projects-and-activities" onClick={() => toggleMenu()}  className=" px-6 py-2 rounded-lg  w-fit  hover:-translate-1 focus:-translate-1 transition font-bold">Projects & Activities</Link>
                    <hr className="my-3 border-gray-500"/>
                </div>
                <div className=" flex flex-col w-full">
                    <Link href="/about" onClick={() => toggleMenu()} className=" px-6 py-2 rounded-lg  w-fit  hover:-translate-1 focus:-translate-1 transition font-bold">About</Link>
                    <hr className="my-3 border-gray-500"/>
                </div>


        </div>
        </>



    )



}


