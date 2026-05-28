import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Settings, Clock, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { webEngines, otherEngines, allEngines } from './constants/engines';
import { fetchYouTubeChannels, fetchYouTubeVideos, fetchYouTubeVideosByChannel, fetchYouTubeFeed } from './services/youtube';
import { VideoResult, ChannelResult, Subscription } from './types';
import VideoModal from './components/VideoModal';

type ThemePreference = 'system' | 'light' | 'dark';

export default function App() {
  const [activeEngineId, setActiveEngineId] = useState(() => localStorage.getItem('preferredEngine') || 'google');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const [youtubeApiKey, setYoutubeApiKey] = useState(() => import.meta.env.VITE_YOUTUBE_API_KEY || localStorage.getItem('youtubeApiKey') || '');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [isMonochromeMode, setIsMonochromeMode] = useState(() => localStorage.getItem('isMonochromeMode') === 'true');
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    return (localStorage.getItem('themePreference') as ThemePreference) || 'system';
  });
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  );

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
  const currentAppliedTheme = useMemo(() => {
    if (themePreference === 'system') {
      return systemTheme;
    }
    return themePreference;
  }, [themePreference, systemTheme]);
  const currentActiveEngine = useMemo(() => allEngines.find(engine => engine.id === activeEngineId) || webEngines[0], [activeEngineId]); // Fallback to first web engine
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
    localStorage.setItem('themePreference', themePreference);
  }, [themePreference]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'light' : 'dark');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Function definitions
  const toggleChannelSubscription = useCallback((channel: Subscription) => {
    setUserSubscriptions(previousSubscriptions => {
      const isCurrentlySubscribed = previousSubscriptions.some(subscription => subscription.id === channel.id);
      if (isCurrentlySubscribed) {
        return previousSubscriptions.filter(subscription => subscription.id !== channel.id);
      }
      return [...previousSubscriptions, channel];
    });
  }, [setUserSubscriptions]);

  const loadUserSubscriptionFeed = useCallback(async () => {
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
  }, [youtubeApiKey, userSubscriptions, setIsContentLoading, setIsViewingFeed, setHasPerformedSearch, setVideoResultsList, setNextPageToken]);

  // Effect for loading user subscription feed on initial load or dependency change
  useEffect(() => {
    if (activeEngineId === 'youtube' && youtubeApiKey && userSubscriptions.length > 0 && !hasPerformedSearch) {
      loadUserSubscriptionFeed();
    }
  }, [activeEngineId, youtubeApiKey, userSubscriptions, hasPerformedSearch, loadUserSubscriptionFeed]);

  // Effect for handling clicks outside the menu
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

  const executeSearch = useCallback(async (event: React.FormEvent) => {
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
  }, [searchQuery, activeEngineId, youtubeApiKey, userSubscriptions, loadUserSubscriptionFeed, setIsContentLoading, setIsViewingFeed, setVideoResultsList, setChannelResultsList, setHasPerformedSearch, setSelectedChannelId, currentActiveEngine]);

  const handleChannelSelection = useCallback(async (channelId: string) => {
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
  }, [youtubeApiKey, setIsContentLoading, setSelectedChannelId, setVideoResultsList, setNextPageToken]);

  const loadMoreVideos = useCallback(async () => {
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
  }, [nextPageToken, isContentLoading, youtubeApiKey, selectedChannelId, searchQuery, setVideoResultsList, setNextPageToken]);

  const themeClasses = {
    dark: {
      bg: 'bg-[#0a0a0a]',
      text: 'text-[#f0f0f0]',
      selection: 'selection:bg-white/10',
      searchBoxBg: 'bg-white/[0.03]',
      searchBoxBorder: 'border-white/[0.08]',
      searchBoxFocusBg: 'focus-within:bg-white/[0.06]',
      searchBoxFocusBorder: 'focus-within:border-white/20',
      searchBoxShadow: 'focus-within:shadow-[0_10px_40px_rgba(255,255,255,0.03)]',
      buttonHoverBg: 'hover:bg-white/[0.08]',
      buttonText: 'text-[#777]',
      buttonHoverText: 'hover:text-[#f0f0f0]',
      menuBg: 'bg-[#121212]/95',
      menuBorder: 'border-white/[0.08]',
      menuShadow: 'shadow-[0_12px_40px_rgba(0,0,0,0.5)]',
      inputPlaceholder: 'placeholder:text-[#777]',
      settingsPanelBg: 'bg-white/[0.03]',
      settingsPanelBorder: 'border-white/[0.08]',
      settingsLabelText: 'text-[#777]',
      settingsInputBg: 'bg-black/20',
      settingsInputBorder: 'border-white/[0.08]',
      settingsInputFocusBorder: 'focus:border-white/20',
      settingsToggleBgOn: 'bg-white/20',
      settingsToggleBgOff: 'bg-white/5',
      settingsToggleCircleBg: 'bg-[#f0f0f0]',
      settingsButtonBg: 'bg-white/[0.08]',
      settingsButtonHoverBg: 'hover:bg-white/[0.12]',
      channelTitleText: 'text-[#aaa]',
      channelCardBg: 'bg-white/[0.02]',
      channelCardHoverBg: 'hover:bg-white/[0.04]',
      channelCardSelectedBg: 'bg-white/[0.06]',
      channelCardSelectedBorder: 'border-white/20',
      channelThumbnailBorder: 'border-white/10',
      subscribeButtonBgSubscribed: 'bg-white/10',
      subscribeButtonBorderSubscribed: 'border-white/20',
      subscribeButtonTextSubscribed: 'text-white',
      subscribeButtonBgUnsubscribed: 'bg-black/40',
      subscribeButtonBorderUnsubscribed: 'border-white/5',
      subscribeButtonTextUnsubscribed: 'text-[#555]',
      subscriptionPillBg: 'bg-white/[0.03]',
      subscriptionPillBorder: 'border-white/[0.05]',
      subscriptionPillHoverBg: 'hover:bg-white/[0.06]',
      subscriptionPillText: 'text-[#aaa]',
      videoCardBg: 'bg-white/[0.03]',
      videoCardBorder: 'border-white/[0.05]',
      videoTitleText: 'text-[#aaa]',
      videoTitleHoverText: 'group-hover:text-[#f0f0f0]',
      videoMetaText: 'text-[#555]',
      videoPlayButtonBg: 'bg-white/10',
      videoPlayButtonBorder: 'border-white/20',
      loadingSpinnerBorder: 'border-white/10',
      loadingSpinnerBorderTop: 'border-t-white/40',
      loadMoreButtonBg: 'bg-white/[0.03]',
      loadMoreButtonHoverBg: 'hover:bg-white/[0.06]',
      loadMoreButtonBorder: 'border-white/[0.08]',
      headerText: 'text-[#444]',
      divider: 'bg-white/[0.08]',
      settingsDivider: 'border-white/[0.05]',
    },
    light: {
      bg: 'bg-white',
      text: 'text-gray-900',
      selection: 'selection:bg-black/10',
      searchBoxBg: 'bg-gray-100',
      searchBoxBorder: 'border-gray-200',
      searchBoxFocusBg: 'focus-within:bg-gray-50',
      searchBoxFocusBorder: 'focus-within:border-blue-300',
      searchBoxShadow: 'focus-within:shadow-[0_10px_40px_rgba(0,0,0,0.05)]',
      buttonHoverBg: 'hover:bg-gray-200',
      buttonText: 'text-gray-600',
      buttonHoverText: 'hover:text-gray-900',
      menuBg: 'bg-white/95',
      menuBorder: 'border-gray-200',
      menuShadow: 'shadow-[0_12px_40px_rgba(0,0,0,0.1)]',
      inputPlaceholder: 'placeholder:text-gray-400',
      settingsPanelBg: 'bg-gray-100',
      settingsPanelBorder: 'border-gray-200',
      settingsLabelText: 'text-gray-600',
      settingsInputBg: 'bg-white',
      settingsInputBorder: 'border-gray-200',
      settingsInputFocusBorder: 'focus:border-blue-300',
      settingsToggleBgOn: 'bg-blue-500',
      settingsToggleBgOff: 'bg-gray-300',
      settingsToggleCircleBg: 'bg-white',
      settingsButtonBg: 'bg-gray-200',
      settingsButtonHoverBg: 'hover:bg-gray-300',
      channelTitleText: 'text-gray-700',
      channelCardBg: 'bg-gray-50',
      channelCardHoverBg: 'hover:bg-gray-100',
      channelCardSelectedBg: 'bg-gray-100',
      channelCardSelectedBorder: 'border-blue-300',
      channelThumbnailBorder: 'border-gray-200',
      subscribeButtonBgSubscribed: 'bg-blue-500',
      subscribeButtonBorderSubscribed: 'border-blue-600',
      subscribeButtonTextSubscribed: 'text-white',
      subscribeButtonBgUnsubscribed: 'bg-gray-200',
      subscribeButtonBorderUnsubscribed: 'border-gray-300',
      subscribeButtonTextUnsubscribed: 'text-gray-600',
      subscriptionPillBg: 'bg-gray-100',
      subscriptionPillBorder: 'border-gray-200',
      subscriptionPillHoverBg: 'hover:bg-gray-200',
      subscriptionPillText: 'text-gray-700',
      videoCardBg: 'bg-gray-100',
      videoCardBorder: 'border-gray-200',
      videoTitleText: 'text-gray-700',
      videoTitleHoverText: 'group-hover:text-gray-900',
      videoMetaText: 'text-gray-500',
      videoPlayButtonBg: 'bg-gray-200',
      videoPlayButtonBorder: 'border-gray-300',
      loadingSpinnerBorder: 'border-gray-300',
      loadingSpinnerBorderTop: 'border-t-blue-500',
      loadMoreButtonBg: 'bg-gray-100',
      loadMoreButtonHoverBg: 'hover:bg-gray-200',
      loadMoreButtonBorder: 'border-gray-200',
      headerText: 'text-gray-500',
      divider: 'bg-gray-200',
      settingsDivider: 'border-gray-200',
    }
  };

  const tc = themeClasses[currentAppliedTheme];

  return (
    <div className={`min-h-screen font-sans overflow-x-hidden ${tc.bg} ${tc.text} ${tc.selection}`}>
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
              className={`search-box flex items-center rounded-[14px] px-3.5 py-2 backdrop-blur-xl transition-all duration-500 focus-within:-translate-y-0.5 w-[85%] sm:w-[85%] focus-within:!w-full ${tc.searchBoxBg} ${tc.searchBoxBorder} ${tc.searchBoxFocusBg} ${tc.searchBoxFocusBorder} ${tc.searchBoxShadow}`}
            >
              <div className="relative" ref={menuContainerRef}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-[0.85rem] font-medium ${tc.buttonText} ${tc.buttonHoverBg} ${tc.buttonHoverText}`}
                >
                  <span>{currentActiveEngine.name}</span>
                </button>

                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className={`absolute top-[calc(100%+12px)] left-0 w-[200px] rounded-xl p-1.5 backdrop-blur-[25px] z-10 ${tc.menuBg} ${tc.menuBorder} ${tc.menuShadow}`}
                    >
                      <div
                        className="relative group/submenu"
                        onMouseEnter={() => setIsSubmenuOpen(true)}
                        onMouseLeave={() => setIsSubmenuOpen(false)}
                      >
                        <div className={`flex items-center justify-between px-3 py-2.5 text-[0.85rem] rounded-lg cursor-pointer ${tc.buttonText} ${tc.buttonHoverBg} ${tc.buttonHoverText}`}>
                          <span>Web Search</span>
                          <span className="text-[0.7rem] opacity-50">›</span>
                        </div>

                        <AnimatePresence>
                          {isSubmenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className={`absolute top-0 left-[calc(100%+8px)] w-[160px] rounded-xl p-1.5 backdrop-blur-[25px] ${tc.menuBg} ${tc.menuBorder} ${tc.menuShadow}`}
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
                                  className={`w-full flex items-center justify-between px-3 py-2 text-[0.8rem] rounded-lg transition-all ${tc.buttonHoverBg} ${activeEngineId === engine.id ? `${tc.text} font-medium` : tc.buttonText}`}
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
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-[0.85rem] rounded-lg transition-all ${tc.buttonHoverBg} ${activeEngineId === engine.id ? `${tc.text} font-medium` : tc.buttonText}`}
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

              <div className={`w-px h-[18px] mx-2.5 ${tc.divider}`} />

              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                autoComplete="off"
                spellCheck="false"
                placeholder={`Pesquisar no ${currentActiveEngine.name}...`}
                className={`flex-1 bg-transparent border-none outline-none text-[0.95rem] ${tc.text} ${tc.inputPlaceholder} placeholder:transition-opacity focus:placeholder:opacity-40 w-full`}
              />
            </form>

            {activeEngineId === 'youtube' && (
              <div className="absolute top-full right-0 mt-3">
                <button
                  onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                  className={`p-2 ${tc.buttonText} ${tc.buttonHoverText} transition-colors opacity-40 hover:opacity-100`}
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
                  <div className={`rounded-xl p-4 backdrop-blur-md space-y-4 ${tc.settingsPanelBg} ${tc.settingsPanelBorder}`}>
                    <div>
                      <label className={`block text-[10px] font-semibold mb-2.5 uppercase tracking-[0.1em] ${tc.settingsLabelText}`}>
                        YouTube API Key
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={youtubeApiKey}
                          onChange={(event) => setYoutubeApiKey(event.target.value)}
                          placeholder="Chave v3..."
                          className={`flex-1 rounded-lg px-3 py-2 text-xs outline-none transition-colors ${tc.settingsInputBg} ${tc.settingsInputBorder} ${tc.settingsInputFocusBorder} ${tc.text}`}
                        />
                      </div>
                    </div>

                    {/* Theme Preference */}
                    <div className={`pt-2 border-t ${tc.settingsDivider}`}>
                      <label className={`block text-[10px] font-semibold mb-2.5 uppercase tracking-[0.1em] ${tc.settingsLabelText}`}>
                        Tema
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setThemePreference('system')}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${themePreference === 'system' ? `${tc.settingsButtonHoverBg} ${tc.text}` : `${tc.settingsButtonBg} ${tc.buttonText}`}`}
                        >
                          Sistema
                        </button>
                        <button
                          onClick={() => setThemePreference('light')}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${themePreference === 'light' ? `${tc.settingsButtonHoverBg} ${tc.text}` : `${tc.settingsButtonBg} ${tc.buttonText}`}`}
                        >
                          Claro
                        </button>
                        <button
                          onClick={() => setThemePreference('dark')}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${themePreference === 'dark' ? `${tc.settingsButtonHoverBg} ${tc.text}` : `${tc.settingsButtonBg} ${tc.buttonText}`}`}
                        >
                          Escuro
                        </button>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between pt-2 border-t ${tc.settingsDivider}`}>
                      <label className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${tc.settingsLabelText}`}>
                        Modo Monocromático
                      </label>
                      <button
                        onClick={() => setIsMonochromeMode(!isMonochromeMode)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${isMonochromeMode ? tc.settingsToggleBgOn : tc.settingsToggleBgOff}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full ${tc.settingsToggleCircleBg} transition-all ${isMonochromeMode ? 'left-[17px]' : 'left-0.5'}`} />
                      </button>
                    </div>

                    <button
                      onClick={() => setShowSettingsPanel(false)}
                      className={`w-full py-2 rounded-lg text-[11px] font-medium transition-colors ${tc.settingsButtonBg} ${tc.settingsButtonHoverBg}`}
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
                <h4 className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-4 px-2 ${tc.headerText}`}>Canais Sugeridos</h4>
                <div className="flex gap-4 overflow-x-auto pb-4 px-2 scrollbar-hide no-scrollbar">
                  {channelResultsList.map((channel) => {
                    const isSubscribed = userSubscriptions.some(sub => sub.id === channel.id);
                    return (
                      <div key={channel.id} className="flex-shrink-0 flex flex-col items-center gap-3 group/channel relative">
                        <button
                          onClick={() => handleChannelSelection(channel.id)}
                          className={`flex flex-col items-center gap-3 p-4 rounded-2xl transition-all border ${selectedChannelId === channel.id ? `${tc.channelCardSelectedBg} ${tc.channelCardSelectedBorder}` : `${tc.channelCardBg} border-transparent ${tc.channelCardHoverBg}`}`}
                        >
                          <img
                            src={channel.thumbnail}
                            alt={channel.title}
                            className={`w-16 h-16 rounded-full object-cover border border-white/10 transition-all duration-500 ${isMonochromeMode ? 'grayscale opacity-60 group-hover/channel:grayscale-0 group-hover/channel:opacity-100' : ''}`}
                            referrerPolicy="no-referrer"
                          />
                          <span className={`text-[0.75rem] font-medium max-w-[100px] truncate ${tc.channelTitleText}`}>{channel.title}</span>
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleChannelSubscription(channel);
                          }}
                          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md border transition-all ${isSubscribed ? `${tc.subscribeButtonBgSubscribed} ${tc.subscribeButtonBorderSubscribed} ${tc.subscribeButtonTextSubscribed}` : `${tc.subscribeButtonBgUnsubscribed} ${tc.subscribeButtonBorderUnsubscribed} ${tc.subscribeButtonTextUnsubscribed} opacity-0 group-hover/channel:opacity-100`}`}
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
                <h4 className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-4 ${tc.headerText}`}>Suas Inscrições</h4>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {userSubscriptions.map(subscription => (
                    <button
                      key={subscription.id}
                      onClick={() => handleChannelSelection(subscription.id)}
                      className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${tc.subscriptionPillBg} ${tc.subscriptionPillBorder} ${tc.subscriptionPillHoverBg}`}
                    >
                      <img src={subscription.thumbnail} className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                      <span className={`text-[10px] ${tc.subscriptionPillText}`}>{subscription.title}</span>
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
                    <div className={`relative aspect-video rounded-xl overflow-hidden mb-3 ${tc.videoCardBg} ${tc.videoCardBorder}`}>
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className={`w-full h-full object-cover transition-all duration-500 ${isMonochromeMode ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100' : ''}`}
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className={`w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center ${tc.videoPlayButtonBg} ${tc.videoPlayButtonBorder}`}>
                          <Play className={`w-5 h-5 ${currentAppliedTheme === 'dark' ? 'fill-white' : 'fill-gray-800'}`} />
                        </div>
                      </div>
                    </div>
                    <h3 className={`text-[0.85rem] font-medium line-clamp-2 transition-colors leading-relaxed ${tc.videoTitleText} ${tc.videoTitleHoverText}`} dangerouslySetInnerHTML={{ __html: video.title }} />
                    <div className={`flex items-center gap-3 mt-2 text-[10px] ${tc.videoMetaText}`}>
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
                <div className={`w-6 h-6 border-2 rounded-full animate-spin ${tc.loadingSpinnerBorder} ${tc.loadingSpinnerBorderTop}`} />
              </div>
            )}

            {nextPageToken && !isContentLoading && (
              <div className="mt-16 flex justify-center">
                <button
                  onClick={loadMoreVideos}
                  className={`px-8 py-3 rounded-full text-[11px] font-bold tracking-[0.2em] uppercase transition-all hover:scale-105 active:scale-95 ${tc.loadMoreButtonBg} ${tc.loadMoreButtonHoverBg} ${tc.loadMoreButtonBorder}`}
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
