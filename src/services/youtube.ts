export const fetchYouTubeChannels = async (query: string, apiKey: string) => {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=8&q=${encodeURIComponent(query)}&type=channel&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return data.items.map((item: any) => ({
        id: item.id.channelId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.default.url,
    }));
};

export const fetchYouTubeVideos = async (query: string, apiKey: string, pageToken?: string) => {
    const searchQuery = `${query} -shorts`;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=12&q=${encodeURIComponent(searchQuery)}&type=video&videoDuration=medium&order=date&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch videos');
    const data = await response.json();
    return {
        items: data.items.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high.url,
            publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString('pt-BR'),
            channelTitle: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
        })),
        nextPageToken: data.nextPageToken || null
    };
};

export const fetchYouTubeVideosByChannel = async (channelId: string, apiKey: string, pageToken?: string) => {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=12&type=video&videoDuration=medium&order=date&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ''}&q=-shorts`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch channel videos');
    const data = await response.json();
    return {
        items: data.items.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high.url,
            publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString('pt-BR'),
            channelTitle: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
        })),
        nextPageToken: data.nextPageToken || null
    };
};

export const fetchYouTubeFeed = async (channelIds: string[], apiKey: string) => {
    const results = await Promise.all(channelIds.slice(0, 5).map(id => fetchYouTubeVideosByChannel(id, apiKey)));
    const allVideos = results.flatMap(r => r.items).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return { items: allVideos, nextPageToken: null };
};
