import React from 'react';
import { Youtube, Github, Globe, Monitor, SearchCode, Compass, Search } from 'lucide-react';
import { SearchEngine } from '../types';

export const webEngines: SearchEngine[] = [
    { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=', icon: <Search className="w-4 h-4" /> },
    { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', icon: <Compass className="w-4 h-4" /> },
    { id: 'brave', name: 'Brave', url: 'https://search.brave.com/search?q=', icon: <Monitor className="w-4 h-4" /> },
    { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=', icon: <SearchCode className="w-4 h-4" /> },
];

export const otherEngines: SearchEngine[] = [
    { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=', icon: <Youtube className="w-4 h-4" /> },
    { id: 'github', name: 'GitHub', url: 'https://github.com/search?q=', icon: <Github className="w-4 h-4" /> },
];

export const allEngines: SearchEngine[] = [...webEngines, ...otherEngines];
