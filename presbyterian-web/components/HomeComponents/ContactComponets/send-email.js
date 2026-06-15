'use server';

import { Resend } from "resend";
import EmailTemplate from "../../../react-email-starter/emails/email-template";
import { headers } from "next/headers";
import { limiter } from "@/Utilities/ratelimit";

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function sendEmail(fullName,phoneNumber,email,message){

    const headerList = await headers()
    const ip = headerList.get("x-forwarded-for") || "127.0.0.1"

    const {success} = await limiter.limit(ip)

    if(!success)
        return {success: false};
    else{
  
        try{
        
        const date = new Date()
        const currentDate = new Intl.DateTimeFormat('en-US', {year:"numeric",month:"long",day:"2-digit"}).format(date)
        const currentTime = new Intl.DateTimeFormat('en-GB', {hour:"2-digit",minute:"2-digit",hour12:true,} ).format(date)

        const {error,data} = await resend.emails.send({
            from: "CUPC<onboarding@resend.dev>",
            to :  "themba21mkandawire@gmail.com",
            subject : "New Site Message",
            react: EmailTemplate({fullName,phoneNumber,email,message,currentTime,currentDate})
        })

        if(error) return error
        
        return {messageSent : true}

    }catch(err){
        console.log("Email Send Erroe",err)
        return false
    } 
   

    }
      
  

    
}