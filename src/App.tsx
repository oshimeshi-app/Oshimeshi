import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BottomNav } from './components/Layout/BottomNav';
import { LoadingScreen } from './components/Layout/LoadingScreen';
import { useRestaurants } from './hooks/useRestaurants';
import { RestaurantWithStats } from './types/database.types';
import { supabase } from './lib/supabase';
import { Search } from 'lucide-react';

const GoogleMapView = lazy(() => import('./components/Map/GoogleMapView').then(m => ({ default: m.GoogleMapView })));
const UnifiedRankingPage = lazy(() => import('./components/Ranking/UnifiedRankingPage').then(m => ({ default: m.UnifiedRankingPage })));
const AuthModal = lazy(() => import('./components/Auth/AuthModal').then(m => ({ default: m.AuthModal })));
const PostForm = lazy(() => import('./components/Restaurant/PostForm').then(m => ({ default: m.PostForm })));
const RestaurantDetail = lazy(() => import('./components/Restaurant/RestaurantDetail').then(m => ({ default: m.RestaurantDetail })));
const UserProfilePage = lazy(() => import('./components/Profile/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const GooglePlacesSearch = lazy(() => import('./components/Search/GooglePlacesSearch').then(m => ({ default: m.GooglePlacesSearch })));
const SearchPage = lazy(() => import('./components/Search/SearchPage').then(m => ({ default: m.SearchPage })));
const CelebrationToast = lazy(() => import('./components/Layout/CelebrationToast').then(m => ({ default: m.CelebrationToast })));
const DownloadPage = lazy(() => import('./components/Download/DownloadPage'));
const FileBrowser = lazy(() => import('./components/Download/FileBrowser').then(m => ({ default: m.FileBrowser })));

function AppContent() {
  const { user } = useAuth();
  const { restaurants, loading, refetch } = useRestaurants();
  const [activeTab, setActiveTab] = useState<'map' | 'ranking' | 'search' | 'profile' | 'download'>('map');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [showPlacesSearch, setShowPlacesSearch] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantWithStats | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [showCelebration, setShowCelebration] = useState(false);
  const [pendingRestaurantId, setPendingRestaurantId] = useState<string | null>(null);
  const [searchFilterRestaurantId, setSearchFilterRestaurantId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  const rankedRestaurants = useMemo(() => {
    return [...restaurants]
      .sort((a, b) => b.favorite_count - a.favorite_count)
      .map((restaurant, index) => ({
        ...restaurant,
        metadata: {
          ...restaurant.metadata,
          japan_rank: index + 1,
        },
      }));
  }, [restaurants]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as 'map' | 'ranking' | 'search' | 'profile' | 'download');
  };

  const handlePlaceSelect = async (place: any) => {
    try {
      if (!place.geometry || !place.geometry.location) {
        alert('この店舗の位置情報が取得できませんでした');
        return;
      }

      const lat = place.geometry.location.lat;
      const lng = place.geometry.location.lng;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        alert('位置情報が正しく取得できませんでした');
        return;
      }

      const photos = place.photos || [];

      // Check if restaurant exists in oshimeshi_restaurants
      const { data: oshimeshiRestaurant } = await supabase
        .from('oshimeshi_restaurants')
        .select('*')
        .eq('google_place_id', place.place_id)
        .maybeSingle();

      // Create a RestaurantWithStats object (from DB or temporary from Google Places)
      const restaurantWithStats: RestaurantWithStats = oshimeshiRestaurant ? {
        id: oshimeshiRestaurant.id,
        user_id: '',
        name: oshimeshiRestaurant.name,
        address: oshimeshiRestaurant.address,
        prefecture: '',
        genre: '',
        comment: '',
        image_url: photos.length > 0 ? photos[0] : null,
        latitude: oshimeshiRestaurant.latitude,
        longitude: oshimeshiRestaurant.longitude,
        created_at: oshimeshiRestaurant.created_at,
        updated_at: oshimeshiRestaurant.created_at,
        favorite_count: oshimeshiRestaurant.votes,
        like_count: 0,
        is_favorited: false,
        is_liked: false,
        metadata: {
          google_place_id: place.place_id,
          google_rating: place.rating,
          google_photos: photos,
        }
      } : {
        id: `temp-${place.place_id}`,
        user_id: '',
        name: place.name,
        address: place.formatted_address,
        prefecture: '',
        genre: '',
        comment: '',
        image_url: photos.length > 0 ? photos[0] : null,
        latitude: lat,
        longitude: lng,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        favorite_count: 0,
        like_count: 0,
        is_favorited: false,
        is_liked: false,
        metadata: {
          google_place_id: place.place_id,
          google_rating: place.rating,
          google_photos: photos,
          is_temporary: true,
        }
      };

      setSelectedRestaurant(restaurantWithStats);
      setShowPlacesSearch(false);
      setActiveTab('map');
      setMapCenter({ lat, lng });
      setMapZoom(16);
    } catch (error) {
      console.error('Failed to handle place selection:', error);
      alert('店舗の表示に失敗しました');
    }
  };

  const handleOshimeshiClick = (latitude: number, longitude: number) => {
    setActiveTab('map');
    setMapCenter({ lat: latitude, lng: longitude });
    setMapZoom(16);
  };

  const handleRankingRestaurantClick = (restaurantId: string) => {
    setPendingRestaurantId(restaurantId);
    setActiveTab('map');
  };

  useEffect(() => {
    const handleNavigateToPost = () => {
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      setShowPlacesSearch(true);
      setActiveTab('map');
    };

    const handleNavigateToMap = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { restaurantId, latitude, longitude } = customEvent.detail;

      setActiveTab('map');
      if (latitude && longitude) {
        setMapCenter({ lat: latitude, lng: longitude });
        setMapZoom(16);
      }
    };

    const handleShowAuthModal = () => {
      setShowAuthModal(true);
    };

    const handleNavigateToSearch = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { restaurantId } = customEvent.detail;

      setSearchFilterRestaurantId(restaurantId);
      setActiveTab('search');
    };

    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('navigate-to-post', handleNavigateToPost);
    window.addEventListener('navigate-to-map', handleNavigateToMap as EventListener);
    window.addEventListener('show-auth-modal', handleShowAuthModal);
    window.addEventListener('navigate-to-search', handleNavigateToSearch as EventListener);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('navigate-to-post', handleNavigateToPost);
      window.removeEventListener('navigate-to-map', handleNavigateToMap as EventListener);
      window.removeEventListener('show-auth-modal', handleShowAuthModal);
      window.removeEventListener('navigate-to-search', handleNavigateToSearch as EventListener);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [user]);

  if (currentPath === '/files') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <FileBrowser />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <div className="h-screen flex flex-col bg-gray-50">
        {activeTab === 'map' && (
          <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <img
                src="/推しメシ.png"
                alt="推しメシ"
                className="w-8 h-8 object-cover rounded-xl"
              />
              <h1 className="text-xl font-bold text-gray-900">推しメシ</h1>
            </div>
            <button
              onClick={() => setShowPlacesSearch(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Search size={24} className="text-gray-700" />
            </button>
          </header>
        )}

        <main className="flex-1 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
                <p className="mt-4 text-gray-600">読み込み中...</p>
              </div>
            </div>
          ) : (
            <>
              <div className={`h-full ${activeTab === 'map' ? 'block' : 'hidden'}`}>
                <Suspense fallback={<LoadingScreen />}>
                  <GoogleMapView
                    restaurants={rankedRestaurants}
                    onRestaurantClick={setSelectedRestaurant}
                    initialCenter={mapCenter}
                    initialZoom={mapZoom}
                    onCenterChange={() => {
                      setMapCenter(null);
                      setMapZoom(12);
                    }}
                    pendingRestaurantId={pendingRestaurantId}
                    onPendingRestaurantHandled={() => setPendingRestaurantId(null)}
                  />
                </Suspense>
              </div>

              {activeTab === 'ranking' && (
                <div className="h-full overflow-y-auto pb-20">
                  <Suspense fallback={<LoadingScreen />}>
                    <UnifiedRankingPage onRestaurantClick={handleRankingRestaurantClick} />
                  </Suspense>
                </div>
              )}

              {activeTab === 'search' && (
                <div className="h-full overflow-y-auto">
                  <Suspense fallback={<LoadingScreen />}>
                    <SearchPage
                      filterRestaurantId={searchFilterRestaurantId}
                      onClearFilter={() => setSearchFilterRestaurantId(null)}
                    />
                  </Suspense>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="h-full overflow-y-auto pb-20">
                  {user ? (
                    <Suspense fallback={<LoadingScreen />}>
                      <UserProfilePage
                        userId={user.id}
                        onLogout={async () => {
                          await supabase.auth.signOut();
                          setActiveTab('map');
                        }}
                        onOshimeshiClick={handleOshimeshiClick}
                      />
                    </Suspense>
                  ) : (
                    <div className="h-full flex items-center justify-center p-4">
                      <div className="text-center">
                        <img
                          src="/推しメシ.png"
                          alt="推しメシ"
                          className="w-16 h-16 mx-auto mb-4 opacity-30 object-cover rounded-2xl"
                        />
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                          ログインしてください
                        </h2>
                        <p className="text-gray-600 mb-6">
                          プロフィールを見るにはログインが必要です
                        </p>
                        <button
                          onClick={() => setShowAuthModal(true)}
                          className="px-6 py-3 bg-orange-500 text-white rounded-full font-bold hover:bg-orange-600 transition-colors"
                        >
                          ログイン
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'download' && (
                <div className="h-full overflow-y-auto">
                  <Suspense fallback={<LoadingScreen />}>
                    <DownloadPage />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </main>

        <BottomNav currentTab={activeTab} onTabChange={handleTabChange} />

        {showAuthModal && (
          <Suspense fallback={null}>
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
          </Suspense>
        )}

        {showPostForm && (
          <Suspense fallback={null}>
            <PostForm
              isOpen={showPostForm}
              onClose={() => setShowPostForm(false)}
              onSuccess={refetch}
            />
          </Suspense>
        )}

        {showPlacesSearch && (
          <Suspense fallback={null}>
            <GooglePlacesSearch
              onPlaceSelect={handlePlaceSelect}
              onClose={() => setShowPlacesSearch(false)}
            />
          </Suspense>
        )}

        {selectedRestaurant && (
          <Suspense fallback={null}>
            <RestaurantDetail
              restaurant={selectedRestaurant}
              isOpen={true}
              onClose={() => setSelectedRestaurant(null)}
              onUpdate={refetch}
              onOshimeshiSet={() => {
                setShowCelebration(true);
                setSelectedRestaurant(null);
                setActiveTab('map');
              }}
              onAuthRequired={() => {
                setSelectedRestaurant(null);
                setShowAuthModal(true);
              }}
            />
          </Suspense>
        )}

        {showCelebration && (
          <Suspense fallback={null}>
            <CelebrationToast
              isVisible={showCelebration}
              onComplete={() => {
                setShowCelebration(false);
                refetch();
              }}
            />
          </Suspense>
        )}
      </div>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
