import { client } from "../client"



export async function getDailyVerse(){
    try{
    const query = `*[_type == "dailyVerse"][0]{verse,scripture}`

    return await client.fetch(query)
    }catch(err){
        console.error("Could not fetch verse", err)
    }

}

export async function getDailyMessage(){

    try{
        const query = `*[_type == "dailyMessage"][0]{title, message, referenceVerse,date}`

        return await client.fetch(query)

    }catch(err){

        console.error("Could not fetch message", err)

    } 

}