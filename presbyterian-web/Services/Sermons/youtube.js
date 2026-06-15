const { google } = require("googleapis");


const youtube = google.youtube({
    version: 'v3',
    auth: process.env.YOUTUBE_API_KEY,
})

export async function getVideos(channelId){

    try{
    const uploadsId = channelId.replace('UC','UU');

    const playlistResponse = await youtube.playlistItems.list({

        part: 'contentDetails',
        playlistId: uploadsId,
        maxResults: 10
    })

    const videoIds = playlistResponse.data.items.map(item => item.contentDetails.videoId).join(',')

    const vidResponse = await youtube.videos.list({
        part: 'snippet , contentDetails',
        id: videoIds,
    })
    return vidResponse.data.items;
    }catch(err) {
        console.error("Failed To obtain vids with api", err)
        return [];
    }
}

export async function getLive() {

try{
        const response = await youtube.search.list({
            part: 'snippet',
            channelId: process.env.YOUTUBE_CHANNEL_ID ,
            type: 'video',
            eventType: 'live'
        }) 

        const liveVideo = response.data.items[0]
        const videoId = liveVideo?.id?.videoId


        if(videoId){

            const statusResponse = await youtube.videos.list({

                part: 'snippet, liveStreamingDetails, status',
                id: videoId,
            })

            const details = statusResponse.data.items[0]
            
            const liveStatus = details.snippet.liveBroadcastContent

            const title = details.snippet.title

            const description = details.snippet.description

            return {id: videoId, status: liveStatus, title: title, description: description}
        }else{
         
        }
    }catch(err){
        console.error("Could not get live video", err)
       
    }
    
}