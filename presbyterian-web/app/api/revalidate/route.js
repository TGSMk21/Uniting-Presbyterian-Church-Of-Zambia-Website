import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";


export async function POST(req){

    try{
        revalidateTag('dailyVerse')
        return NextResponse.json({revalidated: true , now: Date.now()})
    }catch(err){
         NextResponse.json({message: 'Error revalidating', err}, {status: 500})
    }
}