'use client';

import { useActionState, useState } from "react";
import sendEmail from "./send-email";
import { Info } from "lucide-react";

async function submitFormAction(previousState ,formData) {

try{
    const fullName = formData.get("fullName")
    const phoneNumber = formData.get("phoneNumber")
    const message = formData.get("message")
    const email = formData.get("email")

    const response = await sendEmail(fullName,phoneNumber,email,message)

    if(response.success){
        return {err: true, message: "Error: Submission limit reached, Try again in an hour"}
    }
        if(response.messageSent)
            return{err: false ,message: "Message Sent Successfully! Thank You."}
        else
            return{err: true ,message: "Error: Message Not Sent"}
       
}catch(err){

    console.log("Send Email Error", err)
}
   
    
}

export default function Contact() {

    const [state,formAction,isPending,] = useActionState(submitFormAction, {err: false , message: null})

    return(

        <form action={formAction} className="py-10 px-15 grid grid-flow-row w-full border rounded-2xl  mt-5 max-w-6/7 mb-10"> 
            <div className="flex flex-col justify-center">
            
            <h1 className="text-2xl text-blue-900 font-bold mb-3 self-center"><strong>Get In Touch</strong> </h1>
            <hr className="max-w-35 min-w-35 border-2 bg-red-600 border-red-600 mb-5 self-center"/>
            <div className="flex flex-col">
            <h1 className="text-blue-950 text-lg">Full Name</h1>
            <input
            required={true}
            name= 'fullName'
            type="Text"
            placeholder="Jane Doe"
            className=" mr-0 mt-1 border-2 rounded-2xl  px-2 py-2 placeholder-gray-400 text-black"
            
            />
            </div>

            <div className="flex flex-col">
            <h1 className="text-blue-950 text-lg mt-2">Phone Number</h1>
            <input
            required={true}
            name='phoneNumber'
            type="number"
            placeholder="e.g.0977677777"
            className=" mr-0 mt-1 border-2 rounded-2xl  px-2 py-2 placeholder-gray-400 text-black"
            />
            </div>
            <div className="flex flex-col">
            <h1 className="text-blue-950 text-lg mt-2">Email-Address</h1>
            <input
            required={true}
            name="email"
            type="email"
            placeholder="example@example.com"
            className=" mr-0 mt-1 border-2 rounded-2xl  px-2 py-2 placeholder-gray-400 text-black"
            />
            </div>

            <div className="flex flex-col">
            <h1 className="text-blue-950 text-lg mt-2">Message</h1>
            <textarea
            required={true}
            name="message"
            rows={4}
            cols={50}
            placeholder="Say something...."
            className=" mr-0 mt-1 border-2 rounded-2xl  px-2 py-2 placeholder-gray-400 text-black"
            />

            </div>

                <button type="submit" disabled={isPending} className="mt-5 mb-3 self-start bg-blue-900 py-2 px-5 rounded-full">
                    {isPending ? <>Submitting...</> : <>Submit</>}
                </button>

            </div>
            {state.message && <div className="self-center">
                { state.err ?
                <div className="flex flex-row justify-start">
                <Info color="red"/> 
                <p className="text-red-700">{state.message}</p>
                </div>
                :
                <div className="flex flex-row justify-start">
                <Info color="green"/> 
                <p className="text-green-700">{state.message}</p>
                </div>
                }
            </div>}

        </form>

    )

}