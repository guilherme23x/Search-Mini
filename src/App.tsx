import React, { useState, useEffect, useRef } from 'react';
import { Play, Settings, Clock, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { webEngines, otherEngines, allEngines } from './constants/engines';
import { fetchYouTubeChannels, fetchYouTubeVideos, fetchYouTubeVideosByChannel, fetchYouTubeFeed } from './services/youtube';
import { VideoResult, ChannelResult, Subscription } from './types';
import VideoModal from './components/VideoModal';

export default function App() {
  const [activeEngineId, setActiveEngineId] = useState(() => localStorage.getItem('preferredEngine') || 'google');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const [youtubeApiKey, setYoutubeApiKey] = useState(() => import.meta.env.VITE_YOUTUBE_API_KEY || localStorage.getItem('youtubeApiKey') || '');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [isMonochromeMode, setIsMonochromeMode] = useState(() => localStorage.getItem('isMonochromeMode') === 'true');

  const [videoResultsList, setVideoResultsList] = useState<VideoResult[]>([]);
  const [channelResultsList, setChannelResultsList] = useState<ChannelResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [hasPerformedSearch, setHasPerformedSearch] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [userSubscriptions, setUserSubscriptions] = useState<Subscription[]>(() => {
    const savedSubscriptions = localStorage.getItem('userSubscriptions');
    return savedSubscriptions ? JSON.parse(savedSubscriptions) : [];
  });
  const [isViewingFeed, setIsViewingFeed] = useState(true);

  const menuContainerRef = useRef<HTMLDivElement>(null);
  const currentActiveEngine = allEngines.find(engine => engine.id === activeEngineId) || webEngines;

  useEffect(() => {
    localStorage.setItem('preferredEngine', activeEngineId);
  }, [activeEngineId]);

  useEffect(() => {
    localStorage.setItem('youtubeApiKey', youtubeApiKey);
  }, [youtubeApiKey]);

  useEffect(() => {
    localStorage.setItem('isMonochromeMode', String(isMonochromeMode));
  }, [isMonochromeMode]);

  useEffect(() => {
    localStorage.setItem('userSubscriptions', JSON.stringify(userSubscriptions));
  }, [userSubscriptions]);

  useEffect(() => {
    if (activeEngineId === 'youtube' && youtubeApiKey && userSubscriptions.length > 0 && !hasPerformedSearch) {
      loadUserSubscriptionFeed();
    }
  }, [activeEngineId, youtubeApiKey]);

  const toggleChannelSubscription = (channel: Subscription) => {
    setUserSubscriptions(previousSubscriptions => {
      const isCurrentlySubscribed = previousSubscriptions.some(subscription => subscription.id === channel.id);
      if (isCurrentlySubscribed) {
        return previousSubscriptions.filter(subscription => subscription.id !== channel.id);
      }
      return [...previousSubscriptions, channel];
    });
  };

  const loadUserSubscriptionFeed = async () => {
    if (!youtubeApiKey || userSubscriptions.length === 0) return;
    setIsContentLoading(true);
    setIsViewingFeed(true);
    setHasPerformedSearch(true);
    setVideoResultsList([]);
    try {
      const feedData = await fetchYouTubeFeed(userSubscriptions.map(sub => sub.id), youtubeApiKey);
      setVideoResultsList(feedData.items);
      setNextPageToken(feedData.nextPageToken);
    } catch (error) {
      console.error(error);
    } finally {
      setIsContentLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutsideMenu(event: MouseEvent) {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setIsSubmenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutsideMenu);
    return () => document.removeEventListener('mousedown', handleClickOutsideMenu);
  }, []);

  const executeSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchQuery.trim()) {
      if (activeEngineId === 'youtube' && userSubscriptions.length > 0) {
        loadUserSubscriptionFeed();
      }
      return;
    }

    if (activeEngineId === 'youtube' && youtubeApiKey) {
      setIsContentLoading(true);
      setIsViewingFeed(false);
      setVideoResultsList([]);
      setChannelResultsList([]);
      setHasPerformedSearch(true);
      setSelectedChannelId(null);
      try {
        const [channelsData, videosData] = await Promise.all([
          fetchYouTubeChannels(searchQuery, youtubeApiKey),
          fetchYouTubeVideos(searchQuery, youtubeApiKey)
        ]);
        setChannelResultsList(channelsData);
        setVideoResultsList(videosData.items);
        setNextPageToken(videosData.nextPageToken);
      } catch (error) {
        console.error(error);
      } finally {
        setIsContentLoading(false);
      }
    } else {
      window.location.href = currentActiveEngine.url + encodeURIComponent(searchQuery);
    }
  };

  const handleChannelSelection = async (channelId: string) => {
    setIsContentLoading(true);
    setSelectedChannelId(channelId);
    setVideoResultsList([]);
    try {
      const channelVideosData = await fetchYouTubeVideosByChannel(channelId, youtubeApiKey);
      setVideoResultsList(channelVideosData.items);
      setNextPageToken(channelVideosData.nextPageToken);
    } catch (error) {
      console.error(error);
    } finally {
      setIsContentLoading(false);
    }
  };

  const loadMoreVideos = async () => {
    if (!nextPageToken || isContentLoading || !youtubeApiKey) return;
    setIsContentLoading(true);
    try {
      let moreVideosData;
      if (selectedChannelId) {
        moreVideosData = await fetchYouTubeVideosByChannel(selectedChannelId, youtubeApiKey, nextPageToken);
      } else {
        moreVideosData = await fetchYouTubeVideos(searchQuery, youtubeApiKey, nextPageToken);
      }
      setVideoResultsList(previousResults => [...previousResults, ...moreVideosData.items]);
      setNextPageToken(moreVideosData.nextPageToken);
    } catch (error) {
      console.error(error);
    } finally {
      setIsContentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] font-sans selection:bg-white/10 overflow-x-hidden">
      <main className="flex flex-col items-center min-h-screen p-4 relative">
        <div
          className={`w-full flex justify-center transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] transform z-50 ${activeEngineId === 'youtube'
            ? 'mt-12 sm:mt-20 mb-8 translate-y-0'
            : 'mt-[45vh] -translate-y-1/2 mb-0'
            }`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1] }}
            className="relative w-full max-w-[480px] flex flex-col items-center"
          >
            <form
              onSubmit={executeSearch}
              className="search-box flex items-center bg-white/[0.03] border border-white/[0.08] rounded-[14px] px-3.5 py-2 backdrop-blur-xl transition-all duration-500 focus-within:bg-white/[0.06] focus-within:border-white/20 focus-within:shadow-[0_10px_40px_rgba(255,255,255,0.03)] focus-within:-translate-y-0.5 w-[85%] sm:w-[85%] focus-within:!w-full"
            >
              <div className="relative" ref={menuContainerRef}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.08] transition-all text-[0.85rem] font-medium text-[#777] hover:text-[#f0f0f0]"
                >
                  <span>{currentActiveEngine.name}</span>
                </button>

                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute top-[calc(100%+12px)] left-0 w-[200px] bg-[#121212]/95 border border-white/[0.08] rounded-xl p-1.5 backdrop-blur-[25px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] z-"
                    >
                      <div
                        className="relative group/submenu"
                        onMouseEnter={() => setIsSubmenuOpen(true)}
                        onMouseLeave={() => setIsSubmenuOpen(false)}
                      >
                        <div className="flex items-center justify-between px-3 py-2.5 text-[0.85rem] rounded-lg text-[#777] hover:bg-white/[0.08] hover:text-[#f0f0f0] cursor-pointer">
                          <span>Web Search</span>
                          <span className="text-[0.7rem] opacity-50">›</span>
                        </div>

                        <AnimatePresence>
                          {isSubmenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="absolute top-0 left-[calc(100%+8px)] w-[160px] bg-[#121212]/95 border border-white/[0.08] rounded-xl p-1.5 backdrop-blur-[25px] shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
                            >
                              {webEngines.map((engine) => (
                                <button
                                  key={engine.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveEngineId(engine.id);
                                    setIsMenuOpen(false);
                                    setIsSubmenuOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-[0.8rem] rounded-lg transition-all hover:bg-white/[0.08] ${activeEngineId === engine.id ? 'text-[#f0f0f0] font-medium' : 'text-[#777]'}`}
                                >
                                  <span className="flex items-center gap-2">
                                    {engine.icon}
                                    {engine.name}
                                  </span>
                                  <span className="text-[0.6rem] opacity-50 font-semibold">{engine.shortName}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {otherEngines.map((engine) => (
                        <button
                          key={engine.id}
                          type="button"
                          onClick={() => {
                            setActiveEngineId(engine.id);
                            setIsMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-[0.85rem] rounded-lg transition-all hover:bg-white/[0.08] ${activeEngineId === engine.id ? 'text-[#f0f0f0] font-medium' : 'text-[#777]'}`}
                        >
                          <span className="flex items-center gap-2">
                            {engine.icon}
                            {engine.name}
                          </span>
                          <span className="text-[0.7rem] opacity-50 font-semibold tracking-wider">{engine.shortName}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-px h-[18px] bg-white/[0.08] mx-2.5" />

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                autoComplete="off"
                spellCheck="false"
                placeholder={`Pesquisar no ${currentActiveEngine.name}...`}
                className="flex-1 bg-transparent border-none outline-none text-[0.95rem] text-[#f0f0f0] placeholder:text-[#777] placeholder:transition-opacity focus:placeholder:opacity-40 w-full"
              />
            </form>

            {activeEngineId === 'youtube' && (
              <div className="absolute top-full right-0 mt-3">
                <button
                  onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                  className="p-2 text-[#777] hover:text-[#f0f0f0] transition-colors opacity-40 hover:opacity-100"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <AnimatePresence>
              {(showSettingsPanel || (activeEngineId === 'youtube' && !youtubeApiKey)) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-6 w-full"
                >
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 backdrop-blur-md space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#777] mb-2.5 uppercase tracking-[0.1em]">
                        YouTube API Key
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={youtubeApiKey}
                          onChange={(event) => setYoutubeApiKey(event.target.value)}
                          placeholder="Chave v3..."
                          className="flex-1 bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-xs outline-none focus:border-white/20 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                      <label className="text-[10px] font-semibold text-[#777] uppercase tracking-[0.1em]">
                        Modo Monocromático
                      </label>
                      <button
                        onClick={() => setIsMonochromeMode(!isMonochromeMode)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${isMonochromeMode ? 'bg-white/20' : 'bg-white/5'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-[#f0f0f0] transition-all ${isMonochromeMode ? 'left-[17px]' : 'left-0.5'}`} />
                      </button>
                    </div>

                    <button
                      onClick={() => setShowSettingsPanel(false)}
                      className="w-full py-2 bg-white/[0.08] hover:bg-white/[0.12] rounded-lg text-[11px] font-medium transition-colors"
                    >
                      Salvar Configurações
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {activeEngineId === 'youtube' && (hasPerformedSearch || isViewingFeed) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-6xl mt-4"
          >
            {channelResultsList.length > 0 && (
              <div className="mb-12">
                <h4 className="text-[10px] font-bold text-[#444] uppercase tracking-[0.2em] mb-4 px-2">Canais Sugeridos</h4>
                <div className="flex gap-4 overflow-x-auto pb-4 px-2 scrollbar-hide no-scrollbar">
                  {channelResultsList.map((channel) => {
                    const isSubscribed = userSubscriptions.some(sub => sub.id === channel.id);
                    return (
                      <div key={channel.id} className="flex-shrink-0 flex flex-col items-center gap-3 group/channel relative">
                        <button
                          onClick={() => handleChannelSelection(channel.id)}
                          className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition-all border ${selectedChannelId === channel.id ? 'bg-white/[0.06] border-white/20' : 'bg-white/[0.02] border-transparent hover:bg-white/[0.04]'}`}
                        >
                          <img
                            src={channel.thumbnail}
                            alt={channel.title}
                            className={`w-16 h-16 rounded-full object-cover border border-white/10 transition-all duration-500 ${isMonochromeMode ? 'grayscale opacity-60 group-hover/channel:grayscale-0 group-hover/channel:opacity-100' : ''}`}
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-[0.75rem] font-medium text-[#aaa] max-w-[100px] truncate">{channel.title}</span>
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleChannelSubscription(channel);
                          }}
                          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md border transition-all ${isSubscribed ? 'bg-white/10 border-white/20 text-white' : 'bg-black/40 border-white/5 text-[#555] opacity-0 group-hover/channel:opacity-100'}`}
                        >
                          <User className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isViewingFeed && userSubscriptions.length > 0 && (
              <div className="mb-8 px-2">
                <h4 className="text-[10px] font-bold text-[#444] uppercase tracking-[0.2em] mb-4">Suas Inscrições</h4>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {userSubscriptions.map(subscription => (
                    <button
                      key={subscription.id}
                      onClick={() => handleChannelSelection(subscription.id)}
                      className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-all"
                    >
                      <img src={subscription.thumbnail} className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                      <span className="text-[10px] text-[#aaa]">{subscription.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {videoResultsList.map((video, index) => (
                  <motion.div
                    key={video.id + index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (index % 12) * 0.03 }}
                    onClick={() => setSelectedVideoId(video.id)}
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-white/[0.03] border border-white/[0.05]">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className={`w-full h-full object-cover transition-all duration-500 ${isMonochromeMode ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100' : ''}`}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                          <Play className="w-5 h-5 fill-white" />
                        </div>
                      </div>
                    </div>
                    <h3 className="text-[0.85rem] font-medium line-clamp-2 text-[#aaa] group-hover:text-[#f0f0f0] transition-colors leading-relaxed" dangerouslySetInnerHTML={{ __html: video.title }} />
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-[#555]">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {video.publishedAt}</span>
                      <span className="opacity-30">•</span>
                      <span className="truncate flex items-center gap-1"><User className="w-3 h-3" /> {video.channelTitle}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {isContentLoading && (
              <div className="flex justify-center mt-12">
                <div className="w-6 h-6 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
              </div>
            )}

            {nextPageToken && !isContentLoading && (
              <div className="mt-16 flex justify-center">
                <button
                  onClick={loadMoreVideos}
                  className="px-8 py-3 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:scale-105 active:scale-95"
                >
                  Mostrar Mais
                </button>
              </div>
            )}
          </motion.div>
        )}
      </main>

      <VideoModal selectedVideoId={selectedVideoId} onClose={() => setSelectedVideoId(null)} />

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
