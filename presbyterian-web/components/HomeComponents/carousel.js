'use client'
import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect } from 'react'


export default function Carousel({slides}){

    const [emblaRef] = useEmblaCarousel({loop:true},[
        Autoplay({delay: 8000, stopOnInteraction: false,})
    ]);
   

    return(

        <div className='overflow-hidden' ref={emblaRef}>
            
            <div className='flex h-full'>

                {slides.map((Component) => (
                    <div key={Component.id} className='flex-[0_0_100%] min-w-0 h-full' >
                        {Component.component}
                    </div>
                ))}

               


            </div>
        </div>



    )
}